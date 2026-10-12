# AGENTS.md

画像調整サイト（`/image-adjust/` 配下で動く、ブラウザ内処理の画像変換・圧縮・アイコン生成ツール）。仕様は `docs/plan.md`。

## 実行環境

- Node.js・pnpm・Playwright のブラウザは Nix の devShell（`flake.nix`）が供給する。エージェントのシェルでは direnv が効かないので、**コマンドは必ず `nix develop -c <cmd>` で実行する**（例 `nix develop -c pnpm install`）
- グローバルインストールはしない。依存はプロジェクトの `package.json` に入れる
- `@playwright/test` は Nix の `playwright-driver` と同じ版（1.63.0）に固定している。上げるときは `flake.lock` の版と揃える
- pnpm 12 はビルドスクリプトを許可制にしている。許可済みは `pnpm-workspace.yaml` の `allowBuilds`（esbuild・workerd）

## 検証コマンド

変更後は次をすべて通す。

| コマンド                        | 内容                                                                        |
| ------------------------------- | --------------------------------------------------------------------------- |
| `nix develop -c pnpm lint`      | Biome（`biome check .`：lint・書式・import の並び。設定は `biome.json`）       |
| `nix develop -c pnpm typecheck` | React Router の型生成 → `tsc`（app 用と worker 用の 2 つ）                  |
| `nix develop -c pnpm test`      | Vitest（`tests/unit/**`・`app/**/*.test.ts(x)`・`worker/**/*.test.ts`）     |
| `nix develop -c pnpm build`     | 本番ビルド（プリレンダリング＋ Worker）→ `scripts/postbuild.ts`             |
| `nix develop -c pnpm test:e2e`  | Playwright（ビルドしてから `vite preview` を起動。PC とスマホ表示）         |

- 整形は `nix develop -c pnpm format`（`biome format --write .`）。lint の自動修正込みなら `nix develop -c pnpm lint:fix`（`biome check --write .`）
- Biome は recommended ＋ a11y（recommended）＋ React hooks 系（`useExhaustiveDependencies`・`useHookAtTopLevel`）を有効にしている。ルールの無効化・ファイル除外で通さない
- `<script>` の中身は `dangerouslySetInnerHTML` ではなく子要素の文字列で書く（React は `<script>` の子をエスケープしない。`noDangerouslySetInnerHtml` 対策）。JSON は `serializeJsonLd()` で `<` 等を逃がしてから入れる
- E2E でビルドを省くときは `E2E_SKIP_BUILD=1 nix develop -c pnpm test:e2e`
- 開発サーバー：`nix develop -c pnpm dev`（http://localhost:5173/image-adjust/）。本番相当の確認は `pnpm build` の後に `nix develop -c pnpm preview`（http://localhost:4173/image-adjust/、workerd で配信）
- `/image-adjust/api/health` は dev・preview の両方で応答する
- デプロイ（`wrangler deploy` / `pnpm run deploy`）と `wrangler login` はまだ行わない

## 構成

- **Vite 8 + React Router 7（framework モード、`ssr: false` + `prerender`）**：全ページ・全言語をビルド時に静的 HTML にする
- **Hono（Cloudflare Worker、`worker/index.ts`）**：`app.basePath("/image-adjust/api")`。`wrangler.jsonc` の `assets.run_worker_first` で API だけ Worker を通し、それ以外は静的アセットを返す
- **`@cloudflare/vite-plugin`**：dev・preview でも Worker を workerd で動かす
- **Tailwind CSS v4**（`@tailwindcss/vite`）＋ shadcn/ui 風の部品（Radix UI）

### 組み合わせの都合で入れている設定（変えるときは注意）

1. **`react-router.config.ts` の `future.v8_viteEnvironmentApi: true`**：`@cloudflare/vite-plugin` と併用するには Vite の Environment API が要る（無いとビルドが manifest を見つけられず失敗する）
2. **`vite.config.ts` のプラグイン順は `reactRouter()` → `cloudflare()`**：逆にすると dev で全リクエストが workerd に渡り、ページが 404 になる
3. **`scripts/postbuild.ts`**：React Router はプリレンダリング HTML を `build/client/image-adjust/` に書くが、Vite は JS / CSS / WASM / `public/` の中身を `build/client/` 直下に書く（URL には base が付くのに出力先には付かない）。Workers の静的アセットは「URL のパス = ディレクトリ内のパス」で配信するので、ビルド後に `build/client/` 直下のものを `build/client/image-adjust/` に移す。あわせて 404 ページを `<言語>/404.html` に置き（`not_found_handling: "404-page"`）、使わない SPA フォールバックを消す
4. **prerender のパスは末尾スラッシュなしで渡す**（`app/lib/site-routes.ts` の `allBuildPaths()`）。付けると本文の無い SPA フォールバックが書き出される
5. **URL は末尾スラッシュ付きに統一**（`/image-adjust/about/`）。Workers の `html_handling: "auto-trailing-slash"` が `/about` を `/about/` にリダイレクトする。サイト内リンク・canonical・hreflang も末尾スラッシュ付きで出す（`localizedPath()` / `withBase()`）
6. Worker の出力先は `vite.config.ts` の `environments.image_adjust.build.outDir`（`build/worker`）。環境名は `wrangler.jsonc` の `name` を snake_case にしたもの
7. **Service Worker は `vite-plugin-pwa` ではなく postbuild で作る**（`scripts/lib/service-worker.ts`）。vite-plugin-pwa は Vite のバンドル完了時に SW を作るが、プリレンダリング HTML はその後に React Router が書き出し、さらに postbuild が配置を変える。これでは日英の全ページの HTML がプリキャッシュに入らず、URL もずれる。そこで postbuild の最後に、`sw/sw.ts` を Vite の build API で IIFE にバンドルし、`workbox-build` の `injectManifest` で `build/client/image-adjust/` の HTML・JS・CSS・WASM 等の一覧を埋め込む。プリキャッシュの URL は配信 URL に揃える（`about/index.html` → `/image-adjust/about/`）。サイズ上限で漏れた（警告が出た）ときはビルドを失敗させる。workbox の各パッケージは pnpm の厳格な node_modules では推移的依存として解決できないので、devDependencies に直接入れている。更新通知（prompt）は `workbox-window` で自前で実装している（`app/components/pwa/pwa-store.ts`）。workbox-window は CommonJS なので、プリレンダリングで読まれないよう動的 import にしている
8. **マニフェスト（日英）と sitemap.xml は Vite プラグイン**（`scripts/vite-plugin-site-files.ts`）で作る。ビルドでは `build/client/` 直下に出し、postbuild が `public/` の中身と同じく移す。dev でも同じ URL で返す。postbuild は Node で直接実行するので拡張子なしの import を含む `app/` のモジュールを読めず、ルート定義を使うものはこちらに置く
9. **`_headers`（CSP 等）は postbuild が `build/client/_headers` に書く**。置き場所は Workers の静的アセットのルートで、`image-adjust/` の中ではない。プリレンダリング HTML のインラインスクリプトはページごとに違う（React Router のハイドレーション用データ等）ので、ページごとにハッシュを計算し、ページの URL の完全一致ルールに CSP を書く。同じヘッダーを複数のルールで付けると値が連結されるので、`/image-adjust/*` のワイルドカードには CSP を書かない。そのため 404 応答には CSP が付かない。`_headers` には「ルール 100 件・1 行 2000 文字」の制限があり、超えるとビルドが失敗する。ページを大きく増やすときは見直す

### 設定値

- `BASE_PATH`（`/image-adjust`）・`SITE_ORIGIN`・ストレージ接頭辞は **`app/lib/config.ts` だけ**で定義する。`vite.config.ts`・`react-router.config.ts`・Worker もここから import する
- `SITE_ORIGIN` の既定値は暫定ドメインの `https://t0n03k1.com`（`DEFAULT_SITE_ORIGIN`）。ビルド時に `VITE_SITE_ORIGIN` で上書きできる。ドメインを変えるときは `DEFAULT_SITE_ORIGIN` と `wrangler.jsonc` の `routes` の 2 か所を変える
  - canonical・hreflang・og:url・sitemap が誤ったオリジンを指したまま公開されないよう、3 段で防ぐ。① 本番ビルドで、使うオリジン（`VITE_SITE_ORIGIN`、未設定なら既定値）が仮の値（example ドメイン等）・https 以外・パス付きなら目立つ警告を出す（`scripts/vite-plugin-site-files.ts`。既定値のままなら出ない。検証用の `pnpm build` は止めない）② 公開は **`pnpm run deploy`**（`pnpm deploy` は pnpm 組み込みのコマンドなので `run` を付ける）で行う。最初に `scripts/check-deploy-env.ts` が同じ判定をして問題があれば止め（未設定なら既定値で通す）、通ったら `pnpm build` → `wrangler deploy`。判定は `scripts/lib/site-origin.ts` ③ 環境変数の雛形は `.env.example`（`.env` / `.env.*` は git に入れない）
- 広告：`VITE_ADSENSE_CLIENT`（未設定なら広告枠は dev で破線のプレースホルダー、本番で非表示）
- アクセス解析：`VITE_CF_ANALYTICS_TOKEN`（Cloudflare Web Analytics。設定したときだけビーコンを入れる）
- PWA の定数（SW の URL・スコープ・キャッシュ名・共有受け取りのパス）は `app/lib/pwa.ts`
- `wrangler.jsonc` の `run_worker_first` と `routes` は JSON なので `/image-adjust` を直書きしている。`BASE_PATH` を変えたらここも変える

### 公開先（暫定ドメイン）

- 公開 URL は `https://t0n03k1.com/image-adjust/`（plan.md §4 のサブパス配置）。`wrangler.jsonc` の `routes` に `t0n03k1.com/image-adjust` と `t0n03k1.com/image-adjust/*` の 2 本（`zone_name: t0n03k1.com`）を書いてある。`t0n03k1.com/image-adjust*` の 1 本にすると `/image-adjust-foo` のような他アプリのパスにも一致するので使わない。dev・preview・E2E は routes を使わない（localhost で配信）
- `pnpm run deploy` は、公開オリジン（`VITE_SITE_ORIGIN`、未設定なら既定値）のホストが `routes[].pattern` のホストのどれとも一致しなければ止まる（canonical 等が配信していないホストを指すのを防ぐ。判定は `scripts/lib/site-origin.ts` の `checkOriginMatchesRoutes()`）。routes が無いとき（workers.dev だけで公開）は、`workers_dev` が有効で、オリジンが `*.workers.dev` のときだけ通す
- `workers_dev: true` は明示している。wrangler は routes があると workers.dev を既定で無効にするため。独自ドメインでの確認が済むまで、workers.dev（`image-adjust.<アカウント>.workers.dev/image-adjust/`）は確認用に残す
- ドメインの準備（Cloudflare 側。デプロイ前に済ませる）：t0n03k1.com を Cloudflare のゾーンに追加し、ネームサーバーを切り替える。ルートの Worker はプロキシ（オレンジの雲）されたホスト名でしか動かないので、`t0n03k1.com` の DNS レコード（A / AAAA / CNAME。ドメイン直下を担当するものが無ければ `AAAA t0n03k1.com 100::` のプロキシ有効レコード）を置く
- www 付き（`www.t0n03k1.com`）でも開けるよう、プロキシ有効の `www` の DNS レコード（例 `AAAA www 100::`）を置き、Cloudflare の Redirect Rule で `www.t0n03k1.com/*` を `https://t0n03k1.com/$1` へ 301 で転送する（コードでは扱わない。routes は www を含まない）
- workers.dev から独自ドメインへの移行（plan.md §3.7。Cloudflare 側で行う。コードでは行わない）：独自ドメインで全機能が動くのを確かめたら、ダッシュボードの Workers & Pages → image-adjust → Settings → Domains & Routes で workers.dev を無効にし、`wrangler.jsonc` の `workers_dev` も `false` にそろえる（そろえないと次のデプロイで有効に戻る）。canonical は既に独自ドメインを指しているので、検索結果の重複はこれで解消する。workers.dev は自分のゾーンではないため、Redirect Rules・Bulk Redirects では 301 を返せない。301 が必須なら、Worker でホスト名を見てリダイレクトする実装（`run_worker_first` の範囲の見直しを含む）が別途要る
- ドメイン直下（`/robots.txt` 等）はこのアプリでは置けない（plan.md §4.3）。ドメイン直下の担当側で `Sitemap: https://t0n03k1.com/image-adjust/sitemap.xml` を書く

## ディレクトリ

```
app/
  root.tsx                 共通レイアウト（<html lang>・テーマのインラインスクリプト・Provider）
  routes.ts                ルート定義（日英を生成）
  routes/                  ページ（home / convert / compress / icons / guide._index / guide.article / about / privacy / terms / not-found）
  components/
    layout/                ヘッダー・ロゴ（LogoMark）・フッター・言語切り替え・テーマ切り替え・LocalizedLink・PageHeader・NotFound
    ui/                    shadcn 風の基本部品
    ads/AdSlot.tsx         広告枠
    seo/                   meta ヘルパー・JSON-LD
    pwa/                   PwaRoot・InstallPrompt・pwa-store（更新通知）・shared-files（共有受け取り）
    content/               MDX の表示（ContentPage・mdx・prose.css）
    analytics/             CloudflareAnalytics（Web Analytics のビーコン）
    tools/                 変換・圧縮ツールの UI 部品（ImageTool・SettingsPanel・ResultList・CompareDialog・SnippetDialog・FileInput・ToolFaq）と、処理の橋渡し（engine.ts・use-image-tool.ts・hooks.ts・preview.ts・collect-files.ts）
    tools/icons/           アイコン生成ツールの UI 部品（IconTool・SourceInput・IconSettingsPanel・IconPreview・IconOutput・use-icon-tool・use-file-urls）
  i18n/                    ja.ts（正）・en.ts・types.ts・langs.ts・index.ts
  theme/                   tokens.css（デザイントークン）・theme.ts（テーマの保存・適用）
  state/ToolSessionProvider.tsx   ツールの作業状態
  hooks/                   use-online・use-hydrated
  lib/                     config.ts・storage.ts・site-routes.ts・utils.ts（cn）・logo.ts（ロゴの図形）
    limits.ts              入力サイズ・枚数・ピクセル数などの上限
    remote-image.ts        URL 入力（Worker の中継 API 経由の取得とファイル名の決定）
    pwa.ts                 PWA の定数（SW の URL・スコープ・キャッシュ名・共有受け取りのパス）
    sitemap.ts             sitemap.xml の組み立て
    web-manifest.ts        サイト自身の日英マニフェストの組み立て
    codecs/                形式判定・デコード・メタデータ・各形式の変換（raster・gif・svg・quantize 等。jSquash・gifsicle・SVGO・libimagequant）
    pipeline/              変換パイプライン（process・processor・target-size・presets・naming・types）。ファイル名の無害化は naming.ts の `sanitizeFileName` / `sanitizePath` に集約する
    archive/               ZIP の入出力（zip-read・zip-write・zip-path）とダウンロード
    icons/                 アイコン生成（設定・配置・canvas 描画・ICO・マニフェスト・HTML スニペット・ZIP・favicon.svg）。DOM に依存しない純粋関数が中心
  workers/                 image.worker.ts（Web Worker。変換・圧縮を comlink で呼ぶ）
content/ja, content/en     MDX（解説ページ・規約類）
sw/sw.ts                   Service Worker（postbuild でバンドル。型チェックは tsconfig.sw.json）
worker/                    Hono の Worker
scripts/postbuild.ts       ビルド後の整形（アセットの移動・404・_headers・sw.js）
scripts/lib/               csp.ts（CSP・_headers）・service-worker.ts（SW の生成）・site-origin.ts（公開オリジンの判定）・icon-generator-entry.ts（generate-icons.ts が Chromium で動かす入口）
scripts/vite-plugin-site-files.ts   マニフェスト・sitemap.xml・記事の訳し漏れ警告
scripts/generate-icons.ts  ロゴ（public/logo.svg）とアプリアイコン（public/）の生成（アイコン生成ツールの処理を Chromium で動かす）
scripts/generate-og-images.ts  OGP 画像（public/og/）の生成（ロゴとサイト名入り）
tests/unit, tests/e2e      Vitest・Playwright
```

## 開発の取り決め

### ツールの状態は `useToolSession()` に置く

言語切り替えは同じページの他言語版へのクライアント側遷移で、ルート id が変わるのでルートのコンポーネントは作り直される。画像・設定・結果を失わない（plan.md §9.2）ために、**ツールの状態はルートコンポーネントの `useState` ではなく `app/state/ToolSessionProvider.tsx` の `useToolSession(key, initial)` に置く**。キーにはツール名の接頭辞を付ける（例 `convert:files`、`icons:settings`）。`File` / `Blob` もそのまま置ける。再読み込みでは消える（保存しない）。`useToolSessionStore().clear("convert:")` でまとめて消せる。`initial` は key ごとに扱う（同じコンポーネントのまま key が変わったら、その時点の `initial` を使う）。

### i18n

- 文言は `app/i18n/ja.ts` に足し、同じキーを `en.ts` に足す（`en` は `satisfies Dictionary` なので、足りない・余分なキーは型エラー）
- 使うときは `const { t, lang } = useI18n()` → `t("nav.convert")`、置換は `t("pages.convert.title", { from, to })`（辞書側は `{from}`）
- React の外（`meta()` 等）では `createT(lang)` / `translate(lang, key)`
- 数値・サイズは `formatNumber(lang, n)` / `formatBytes(lang, bytes)`
- サイト内リンクは `<LocalizedLink page="icons">`（表示中の言語の URL になる）。パスの組み立ては `localizedPath(lang, page)`
- Vitest が日英のキー一致と置換変数の一致を検査する

### ルートの追加

1. `app/routes/<name>.tsx` を作る（`meta()` は `buildPageMeta()` を返す。既存ページを参照）
2. `app/routes.ts` の `pages()` に `route("path", "routes/<name>.tsx", { id: id("<name>") })` を足す（日英の両方が生成される）
3. `app/lib/site-routes.ts` の `allPagePaths()` に足す（prerender の対象）
- 動的セグメント（`:pair` 等）は使わない。変換・圧縮・解説は `CONVERT_PAIRS`・`COMPRESS_FORMATS`・`GUIDE_SLUGS` の値ごとに静的ルートを登録し（同じモジュールを `ja/convert/png-to-webp` 等の別 id で）、ページ側は `pageParam(pathname, "convert")` でパスから値を取り出す。動的ルートだと不正な値（`/convert/bogus/`）で、配信される 404.html とクライアントのマッチが食い違い、ハイドレーションに失敗する。静的ルートなら不正な値は splat（not-found）に落ちる
4. 必要なら `nav-items.ts` と辞書に足す

### SEO

- 各ルートの `meta({ location })` で `metaContext(location.pathname)` から `lang`・`page`・`t` を得て `buildPageMeta({ lang, page, title, description, ... })` を返す。title・description・canonical・OGP・Twitter・hreflang（ja / en / x-default）・パンくずの JSON-LD が絶対 URL で入る
- 追加の構造化データは `jsonLd: [webApplicationJsonLd(...)]` / `articleJsonLd` / `faqJsonLd`（`app/components/seo/json-ld.ts`）。本文中に置くなら `<JsonLd data={...} />`

### テーマ・デザイン

- 色は `app/theme/tokens.css` の CSS 変数だけで定義し、Tailwind からは `bg-background`・`text-muted-foreground`・`border-border`・`bg-surface`・`text-success` 等で参照する。`dark:` は `<html data-theme="dark">` に紐付いている
- 透過画像の背景は `bg-checker`（市松模様、テーマで濃淡が変わる）
- インラインスクリプト（`THEME_INIT_SCRIPT` 等）の CSP ハッシュはビルド時に自動で計算する（手で更新しなくてよい）。外部スクリプトや iframe を足すときは `scripts/lib/csp.ts` の許可リストに足す
- タップ領域は 44px 以上（`Button` の既定サイズは h-11）
- ヘッダーは固定（h-14）。アンカーやスキップリンクの移動先が隠れないよう `html` に `scroll-padding-top` を付けている（`app.css`）。記事の見出しの `scroll-margin-top`（`prose.css`）はこれに足される余白
- 画面下に重ねて出す通知（言語の案内 `LangSuggestion`・PWA の更新／受け取り件数 `PwaRoot`）は、`app/components/layout/BottomNotices.tsx` の固定コンテナ 1 つに `<BottomNotice>` でポータルして縦に積む（別々に fixed にすると重なって押せなくなる。ページの流れに入れると CLS）。位置は `bottom-above-action-bar`（スマホのツール画面の下固定バー `data-mobile-action-bar` の上）。何か出ている間はコンテナの実際の高さ（ResizeObserver → `--bottom-notices-height`）だけ body の下に余白を足し、フッターを隠さない。画面下の通知を足すときもここに入れる

### UI 部品（`app/components/ui/`）

`button`（`buttonVariants`・`asChild`）・`card`・`input`・`label`・`slider`・`select`・`tabs`・`switch`・`checkbox`・`radio-group`・`toggle-group`・`dialog`・`sheet`（下から出るシート。`side="bottom"` が既定）・`dropdown-menu`・`progress`・`badge`（`success` / `warning` / `destructive`）・`tooltip`。クラスの結合は `cn()`（`app/lib/utils.ts`）。

### ストレージ

`localStorage` は直接使わず `app/lib/storage.ts`（`getItem` / `setItem` / `getJSON` / `setJSON`）を使う。キーには自動で `image-adjust:` が付く。使うキーは `STORAGE_KEYS` に足す。Cache Storage・IndexedDB の名前にも `STORAGE_PREFIX` を付ける。

### Web Worker・WASM

- Worker は `new Worker(new URL("../workers/image.worker.ts", import.meta.url), { type: "module" })` で作り、`comlink` の `wrap` / `expose` で呼ぶ（`vite.config.ts` の `worker.format` は `es`）
- jSquash（`@jsquash/*`）は Worker 内で普通に `import { encode } from "@jsquash/webp"` すればよい。WASM は Vite が `assets/` に出力し、postbuild で `/image-adjust/assets/` に揃う（dev・preview で動作確認済み）
- WASM とコーデックは画像が入力されたときに動的 import する（初回表示に含めない）
- PNG 減色は `libimagequant-wasm`（Worker 対応）を第一候補、`image-q`（純 JS）を代替として入れてある
- dev で初めて読み込む依存があると Vite の依存最適化で 1 回再読み込み（504 Outdated Optimize Dep）が起きることがある。気になるなら `optimizeDeps.include` に足す

### 広告枠

`<AdSlot format="banner" | "sidebar" | "responsive" | "in-article" slot="..." />`。高さを先に確保し、ラベル・枠線付き、オフライン時は非表示。ドロップエリア・ダウンロードボタン・設定パネルの近くには置かない。ヘッダー直下のバナーは `root.tsx` に置いてある。

### 依存

必要な依存はすべて入れてある（jSquash・libimagequant-wasm・image-q・gifsicle-wasm-browser・svgo・fflate・comlink・workbox-build・workbox-window・@mdx-js/rollup・remark-gfm・happy-dom・@testing-library/react 等）。並列作業で lock が衝突するので、追加が必要なら理由を添えて相談する。

### その他

- E2E の 404 テスト：dev サーバーでは存在しないパスも 200 で返る（404.html はビルド後にだけある）。404 の確認は preview で行う
- `vite-plugin-pwa` は使っていない（「組み合わせの都合」7）。SW は本番ビルド（preview を含む）でだけ登録する。dev には sw.js が無い

### PWA

- Service Worker：`/image-adjust/sw.js`、スコープ `/image-adjust/`。プリキャッシュだけで、ランタイムキャッシュは持たない（広告・解析・`/image-adjust/api/` はキャッシュしない）。キャッシュ名は `image-adjust-precache-…`、古いキャッシュの削除も `image-adjust-precache-` で始まるものだけ
- 更新：新しい版が待機中なら「更新があります」→「再読み込み」で SKIP_WAITING → 切り替わったら再読み込み。他のタブで先に切り替わったときは、作業中の画像を失わせないため自動では再読み込みせず「再読み込みしてください」と案内する（`pwa-store.ts`）
- 共有受け取り：マニフェストの `share_target`（POST `/image-adjust/share-target`）を SW が受けて Cache Storage（`image-adjust:share-target`）に一時保存し、`/image-adjust/?share=1`（英語は `/en/?share=1`）にリダイレクトする。ページ側の `app/components/pwa/PwaRoot.tsx` が取り出して `pushIncomingFiles()` に渡し、キャッシュを消す。`file_handlers`（launchQueue）も同じく `pushIncomingFiles()` に渡す。ツール側は `subscribeIncomingFiles()` で受け取る
- 共有受け取りは他サイトからのフォーム POST を受け取らない（`Sec-Fetch-Site` が `none`（OS の共有）・`same-origin` 以外なら保存せずリダイレクトだけ。ヘッダーが SW に見えない環境では Referer のオリジンで判定）。**未確認：Android 実機の共有で `Sec-Fetch-Site: none`（またはヘッダー無し・Referer 無し）になること**
- OGP 画像：`public/og/<lang>.png`（1200×630、言語ごとに共通の 1 枚）。`buildPageMeta()` が `image` 省略時に自動で付ける。作り直しは `nix develop -c node scripts/generate-og-images.ts`（Playwright の Chromium で描画）
- サイト名：`Image Adjust`（日英共通の正式名。`app/i18n` の `site.name`・`app/lib/config.ts` の `SITE_NAME`）
- ロゴ：図形は `app/lib/logo.ts` だけで定義する（角丸の正方形の面に、山と太陽の写真マークと調整スライダーを抜いた形。32 の格子で 16px でも潰れないように設計）。ヘッダーは `LogoMark`（インライン SVG。面は `currentColor`、記号は背景色のトークンで塗るので、テーマに合わせて白黒が反転する）。単体のファイルは `public/logo.svg`（黒地に白）
- アイコン：`public/favicon.ico`・`favicon.svg`・`apple-touch-icon.png`・`public/pwa/icon-*.png`。ロゴを元に、アイコン生成ツール（`app/lib/icons/`）と同じ処理で作る（plan.md §6.1）。ロゴを変えたら `nix develop -c node scripts/generate-icons.ts`（`public/logo.svg` とアイコン）→ `nix develop -c node scripts/generate-og-images.ts`（OGP 画像）で作り直す。16px・32px での見え方は `/icons/` ページに `public/logo.svg` を入れるとライト・ダークのタブで確かめられる。`public/icons/` は `/icons/` ページと衝突するので使わない

### 記事（MDX）

- `content/<lang>/<name>.mdx`。ガイドは `GUIDE_SLUGS`、他に about・privacy・terms。日英で同じファイル名にする（片方しか無いとビルドで警告、Vitest で失敗）
- 先頭で `export const frontmatter = { title, description, datePublished, dateModified }` を出す（YAML は使えない）。title がページの h1 と `<title>` になる。本文の見出しは h2 から
- サイト内リンクは BASE_PATH と言語接頭辞なしのページパスで書く（`[変換](/convert/png-to-webp/)`）。表示中の言語の URL に直る
- ガイドの記事内広告は本文中の `<Ad />`（1 枠）＋ページ末尾（1 枠）
- 本文中（コードブロックの外）に `{` `}` `<` を素で書かない（JSX として解釈される）。見た目は `app/components/content/prose.css`
- フッターの「外部送信について」は `privacy.mdx` の `<h2 id="external-transmission">` へのリンク（`EXTERNAL_TRANSMISSION_ANCHOR`）
