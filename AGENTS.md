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
- デプロイ（`wrangler deploy`）と `wrangler login` はまだ行わない

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
- `SITE_ORIGIN` はビルド時に `VITE_SITE_ORIGIN` で上書きできる（既定は仮の `https://image-adjust.example.workers.dev`）
- 広告：`VITE_ADSENSE_CLIENT`（未設定なら広告枠は dev で破線のプレースホルダー、本番で非表示）
- アクセス解析：`VITE_CF_ANALYTICS_TOKEN`（Cloudflare Web Analytics。設定したときだけビーコンを入れる）
- PWA の定数（SW の URL・スコープ・キャッシュ名・共有受け取りのパス）は `app/lib/pwa.ts`
- `wrangler.jsonc` の `run_worker_first` だけは JSON なので `/image-adjust` を直書きしている。`BASE_PATH` を変えたらここも変える

## ディレクトリ

```
app/
  root.tsx                 共通レイアウト（<html lang>・テーマのインラインスクリプト・Provider）
  routes.ts                ルート定義（日英を生成）
  routes/                  ページ（home / convert.$pair / compress.$format / icons / guide._index / guide.$slug / about / privacy / terms / not-found）
  components/
    layout/                ヘッダー・フッター・言語切り替え・テーマ切り替え・LocalizedLink・PageHeader・NotFound
    ui/                    shadcn 風の基本部品
    ads/AdSlot.tsx         広告枠
    seo/                   meta ヘルパー・JSON-LD
    tools/                 （ツールの UI 部品。フェーズ 2 以降）
  i18n/                    ja.ts（正）・en.ts・types.ts・langs.ts・index.ts
  theme/                   tokens.css（デザイントークン）・theme.ts（テーマの保存・適用）
  state/ToolSessionProvider.tsx   ツールの作業状態
  hooks/                   use-online・use-hydrated
  lib/                     config.ts・storage.ts・site-routes.ts・utils.ts（cn）
  workers/                 （Web Worker。フェーズ 2 以降）
content/ja, content/en     MDX（解説ページ・規約類）
sw/sw.ts                   Service Worker（postbuild でバンドル。型チェックは tsconfig.sw.json）
worker/                    Hono の Worker
scripts/postbuild.ts       ビルド後の整形（アセットの移動・404・_headers・sw.js）
scripts/lib/               csp.ts（CSP・_headers）・service-worker.ts（SW の生成）
scripts/vite-plugin-site-files.ts   マニフェスト・sitemap.xml・記事の訳し漏れ警告
scripts/generate-icons.ts  仮のアプリアイコン（public/）の生成（ICO は app/lib/icons/ico.ts を使う）
scripts/generate-og-images.ts  OGP 画像（public/og/）の生成
tests/unit, tests/e2e      Vitest・Playwright
```

## 開発の取り決め

### ツールの状態は `useToolSession()` に置く

言語切り替えは同じページの他言語版へのクライアント側遷移で、ルート id が変わるのでルートのコンポーネントは作り直される。画像・設定・結果を失わない（plan.md §9.2）ために、**ツールの状態はルートコンポーネントの `useState` ではなく `app/state/ToolSessionProvider.tsx` の `useToolSession(key, initial)` に置く**。キーにはツール名の接頭辞を付ける（例 `convert:files`、`icons:settings`）。`File` / `Blob` もそのまま置ける。再読み込みでは消える（保存しない）。`useToolSessionStore().clear("convert:")` でまとめて消せる。

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
3. `app/lib/site-routes.ts` の `allPagePaths()` に足す（prerender の対象。動的セグメントの値はここで列挙）
4. 必要なら `nav-items.ts` と辞書に足す

### SEO

- 各ルートの `meta({ location })` で `metaContext(location.pathname)` から `lang`・`page`・`t` を得て `buildPageMeta({ lang, page, title, description, ... })` を返す。title・description・canonical・OGP・Twitter・hreflang（ja / en / x-default）・パンくずの JSON-LD が絶対 URL で入る
- 追加の構造化データは `jsonLd: [webApplicationJsonLd(...)]` / `articleJsonLd` / `faqJsonLd`（`app/components/seo/json-ld.ts`）。本文中に置くなら `<JsonLd data={...} />`

### テーマ・デザイン

- 色は `app/theme/tokens.css` の CSS 変数だけで定義し、Tailwind からは `bg-background`・`text-muted-foreground`・`border-border`・`bg-surface`・`text-success` 等で参照する。`dark:` は `<html data-theme="dark">` に紐付いている
- 透過画像の背景は `bg-checker`（市松模様、テーマで濃淡が変わる）
- インラインスクリプト（`THEME_INIT_SCRIPT` 等）の CSP ハッシュはビルド時に自動で計算する（手で更新しなくてよい）。外部スクリプトや iframe を足すときは `scripts/lib/csp.ts` の許可リストに足す
- タップ領域は 44px 以上（`Button` の既定サイズは h-11）

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

フェーズ 0 で後続が使う依存はすべて入れてある（jSquash・libimagequant-wasm・image-q・gifsicle-wasm-browser・svgo・fflate・comlink・vite-plugin-pwa・workbox-window・@mdx-js/rollup・remark-gfm・happy-dom・@testing-library/react 等）。並列作業で lock が衝突するので、追加が必要なら理由を添えて相談する。

### その他

- E2E の 404 テスト：dev サーバーでは存在しないパスも 200 で返る（404.html はビルド後にだけある）。404 の確認は preview で行う
- `vite-plugin-pwa` は使っていない（「組み合わせの都合」7）。SW は本番ビルド（preview を含む）でだけ登録する。dev には sw.js が無い

### PWA

- Service Worker：`/image-adjust/sw.js`、スコープ `/image-adjust/`。プリキャッシュだけで、ランタイムキャッシュは持たない（広告・解析・`/image-adjust/api/` はキャッシュしない）。キャッシュ名は `image-adjust-precache-…`、古いキャッシュの削除も `image-adjust-precache-` で始まるものだけ
- 更新：新しい版が待機中なら「更新があります」→「再読み込み」で SKIP_WAITING → 切り替わったら再読み込み。他のタブで先に切り替わったときは、作業中の画像を失わせないため自動では再読み込みせず「再読み込みしてください」と案内する（`pwa-store.ts`）
- 共有受け取り：マニフェストの `share_target`（POST `/image-adjust/share-target`）を SW が受けて Cache Storage（`image-adjust:share-target`）に一時保存し、`/image-adjust/?share=1`（英語は `/en/?share=1`）にリダイレクトする。ページ側の `app/components/pwa/PwaRoot.tsx` が取り出して `pushIncomingFiles()` に渡し、キャッシュを消す。`file_handlers`（launchQueue）も同じく `pushIncomingFiles()` に渡す。ツール側は `subscribeIncomingFiles()` で受け取る
- 共有受け取りは他サイトからのフォーム POST を受け取らない（`Sec-Fetch-Site` が `none`（OS の共有）・`same-origin` 以外なら保存せずリダイレクトだけ。ヘッダーが SW に見えない環境では Referer のオリジンで判定）。**未確認：Android 実機の共有で `Sec-Fetch-Site: none`（またはヘッダー無し・Referer 無し）になること**
- OGP 画像：`public/og/<lang>.png`（1200×630、言語ごとに共通の 1 枚）。`buildPageMeta()` が `image` 省略時に自動で付ける。作り直しは `nix develop -c node scripts/generate-og-images.ts`（Playwright の Chromium で描画）
- アイコン：`public/favicon.ico`・`favicon.svg`・`apple-touch-icon.png`・`public/pwa/icon-*.png`。今は `scripts/generate-icons.ts` で作った仮のもの（`nix develop -c node scripts/generate-icons.ts`）。`public/icons/` は `/icons/` ページと衝突するので使わない

### 記事（MDX）

- `content/<lang>/<name>.mdx`。ガイドは `GUIDE_SLUGS`、他に about・privacy・terms。日英で同じファイル名にする（片方しか無いとビルドで警告、Vitest で失敗）
- 先頭で `export const frontmatter = { title, description, datePublished, dateModified }` を出す（YAML は使えない）。title がページの h1 と `<title>` になる。本文の見出しは h2 から
- サイト内リンクは BASE_PATH と言語接頭辞なしのページパスで書く（`[変換](/convert/png-to-webp/)`）。表示中の言語の URL に直る
- ガイドの記事内広告は本文中の `<Ad />`（1 枠）＋ページ末尾（1 枠）
- 本文中（コードブロックの外）に `{` `}` `<` を素で書かない（JSX として解釈される）。見た目は `app/components/content/prose.css`
- フッターの「外部送信について」は `privacy.mdx` の `<h2 id="external-transmission">` へのリンク（`EXTERNAL_TRANSMISSION_ANCHOR`）
