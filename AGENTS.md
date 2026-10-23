# AGENTS.md

1 つのドメイン（https://t0n03k1.com）に、ブラウザ内で動く便利なアプリを多数載せるサイト。ポータル（アプリの一覧）が `/`、各アプリが `/<アプリ>/`。英語版はアプリのパスの内側に `/en/` を付ける（`/image-adjust/en/`。ポータルは `/en/`）。サイト名は仮（日 `便利ツール集`・英 `Handy Tools`）で、`app/platform/config/index.ts` の `SITE_NAME` 1 か所だけで定義する。決まったらそこを変える。

現在のアプリ：`portal`（`/`）・`image-adjust`（画像の変換・圧縮・アイコン生成）・`markdown-pdf`（Markdown → PDF）。サイト全体の方針は、ローカルの `docs/site-plan.md`（docs/ は gitignore 済み）。各アプリの仕様は同じくローカルの `docs/` にある。

## 実行環境

- Node.js・pnpm・Playwright のブラウザは Nix の devShell（`flake.nix`）が供給する。エージェントのシェルでは direnv が効かないので、**コマンドは必ず `nix develop -c <cmd>` で実行する**（例 `nix develop -c pnpm install`）
- グローバルインストールはしない。依存はプロジェクトの `package.json` に入れる
- `@playwright/test` は Nix の `playwright-driver` と同じ版（1.63.0）に固定している。上げるときは `flake.lock` の版と揃える
- pnpm 12 はビルドスクリプトを許可制にしている。許可済みは `pnpm-workspace.yaml` の `allowBuilds`（esbuild・workerd）

## 検証コマンド

変更後は次をすべて通す。

| コマンド                        | 内容                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `nix develop -c pnpm lint`      | Biome（`biome check .`：lint・書式・import の並び。設定は `biome.json`）＋ 依存の境界の検査（`scripts/check-boundaries.ts`） |
| `nix develop -c pnpm typecheck` | React Router の型生成 → `tsc`（app 用・worker／API 用・Service Worker 用の 3 つ）                              |
| `nix develop -c pnpm test`      | Vitest（`tests/unit/**`・`app/**/*.test.ts(x)`・`worker/**/*.test.ts`）                                         |
| `nix develop -c pnpm build`     | 本番ビルド（プリレンダリング＋ Worker）→ `scripts/postbuild.ts`                                                 |
| `nix develop -c pnpm test:e2e`  | Playwright（ビルドしてから `vite preview` を起動。PC とスマホ表示。サイト共通の `tests/e2e` と各アプリの `app/apps/<id>/tests/e2e`） |
| `nix develop -c pnpm check:apps`| ポータル以外のアプリを 1 つずつ外した複製（一時ディレクトリ）で `typecheck`・`build` が通るかを見る。アプリが 2 つ以上あれば全部外した状態も見る。引数にアプリの id を渡すとそれだけ確かめる（`scripts/check-app-removal.ts`）。CI でも流す |

- 整形は `nix develop -c pnpm format`（`biome format --write .`）。lint の自動修正込みなら `nix develop -c pnpm lint:fix`（`biome check --write .`）。`lint:fix` は境界の検査を含まない
- Biome は recommended ＋ a11y（recommended）＋ React hooks 系（`useExhaustiveDependencies`・`useHookAtTopLevel`）を有効にしている。ルールの無効化・ファイル除外で通さない
- Biome は md を検査しない（この AGENTS.md は lint の対象外）
- `<script>` の中身は `dangerouslySetInnerHTML` ではなく子要素の文字列で書く（React は `<script>` の子をエスケープしない。`noDangerouslySetInnerHtml` 対策）。JSON は `serializeJsonLd()` で `<` 等を逃がしてから入れる
- E2E でビルドを省くときは `E2E_SKIP_BUILD=1 nix develop -c pnpm test:e2e`。E2E のポートは `E2E_PORT` で変えられる（既定 4173）
- 開発サーバー：`nix develop -c pnpm dev`（http://localhost:5173/）。本番相当の確認は `pnpm build` の後に `nix develop -c pnpm preview`（http://localhost:4173/、workerd で配信）
- `/image-adjust/api/health` は dev・preview の両方で応答する（E2E の起動確認もこの URL）
- デプロイは `pnpm run deploy`（公開前の確認 → ビルド → `wrangler deploy`）。`main` へのマージで CI が通ると、GitHub Actions（`.github/workflows/deploy.yml`）が同じ処理を自動で行う。ローカルの `wrangler login` はユーザーが行う（エージェントは代行しない）

## 構成と依存の決まり

### platform と apps

- **`app/platform/`（土台）**：どのアプリにも依存しない。ヘッダー・ハンバーガーメニュー・フッター（`shell/`）、アプリの登録簿（`registry/`）、i18n の仕組みと共通の文言、広告枠（`ads/`）、SEO（`seo/`）、ストレージ（`storage/`）、テーマ（`theme/`）、UI 部品（`ui/`）、サイト共通の規約類（`legal/`・`pages/`・`content/`）、設定値（`config/`）
- **`app/apps/<id>/`（アプリ）**：差し込み式。ポータル（`portal`、path が空）も 1 つのアプリとして同じ規約で置く。アプリ固有のものは全部そのフォルダの中に置く（文言・ページ・ルート・規約の節・API・public・テスト・E2E・ビルド後フック）

### import の決まり

```
apps/<A> ──▶ platform ◀── apps/<B>          apps/<A> ✕ apps/<B>
platform ──▶ apps/*/manifest.ts 等（規約による自動収集だけ。下記）
アプリの中： pages ─▶ features/*/index.ts ─▶ domain
            features/*/adapters ─▶ features/*/core ─▶ domain
            pages・features ─▶ shared ─▶ domain
            feature ✕ feature、page ✕ page（組み合わせは pages でだけ行う）
```

- アプリは `platform` と自分自身だけを import する。アプリ同士は import しない。アプリ間で共有したい処理は `platform` に上げる（アプリから直接借りない）
- `platform` はアプリを import しない。例外は規約による自動収集（`import.meta.glob`）だけで、収集元とパターンの組は `scripts/check-boundaries.ts` の `COLLECTION_GLOBS` に固定している：`app/platform/registry/index.ts` が `app/apps/*/manifest.ts`、`app/platform/legal/index.tsx` が `app/apps/*/legal/{privacy,terms}.{ja,en}.mdx`、`worker/index.ts` が `app/apps/*/api/index.ts`
- `scripts/`・`worker/`・`app/root.tsx`・`app/routes.ts`・`vite.config.ts`・`react-router.config.ts` から特定のアプリを import しない（フォルダの走査で集める）
- `manifest.ts` は `platform` の型だけを import し、データだけを持つ。登録簿・メニュー・ポータル・sitemap を、アプリの中身を読まずに作るため
- ストレージのキーは `<アプリ id>:`、土台は `site:`。Cache Storage・IndexedDB の名前も同じ接頭辞にする（データもアプリ単位で分かれる）

### アプリの中の構成（markdown-pdf が手本）

- `domain/`：用語・規則・型・上限値。何にも依存しない（自分の `domain/` と型だけの import 以外は検査で不可。DOM のグローバル・型も使えない。端末の判定のように navigator 等を読むものは `shared/` や adapters に置く）
- `features/<機能>/`：`core/`（純粋なロジックと外部との窓口 port の定義。ライブラリ・DOM・ストレージを知らない。DOM なしで単体テストできる）・`adapters/`（ライブラリ・DOM 等を使う実装。port を満たす）・`ui/`（その機能の部品）・`index.ts`（外に公開する窓口）。feature の外からは `index.ts` だけを import できる。`core` が import できるのは自分の `core` と `domain` だけで、DOM のグローバル・型も使えない
- `shared/`：アプリの中で複数の feature・ページ・レイアウトが使うもの（設定値・SEO の補助・ロゴ等）。features・pages には依存しない（検査される）
- `pages/<ページ>/`：features を組み合わせて画面を作る（依存の注入もここ）。ページ同士は import しない。ルートのファイルは `pages/<ページ>/route.tsx`
- feature 同士は import しない。ある feature が別の feature の処理を要るときは、共通部分を `domain/`・`shared/` に移すか、ページで組み合わせて注入する（例：Image Adjust の URL 入力は、`image-processing` の `ImageTool` が受け取る `remoteImage` に、ページが `remote-image` の `remoteImageLoader` を渡す）
- feature の外（ページ・レイアウト・テスト・スクリプト）からは `features/<機能>/index.ts` だけを import する。公開窓口はページ・レイアウト・規約ファイルが使うものに絞る。内部関数のテストは feature 内に置き、相対パスで import する（`vi.mock` は import ではないので内部のパスを指してよい）
- 規約で集めるファイル（`manifest.ts`・`routes.ts`・`layout*.tsx`・`legal/`・`api/index.ts`・`build/postbuild.ts`・`site-files.ts`・`public/`・`content/`・`scripts/`・`sw/`）はアプリの直下に置く（動かすと収集が壊れる）。Node から直接読まれるもの（`routes.ts`・`site-files.ts`・`sw/sw.ts`・`scripts/` から辿る `domain/`・`shared/` の一部）は `.ts` の拡張子付きの相対 import で書き、`~/` やバレル（index）を経由しない

これらは `scripts/check-boundaries.ts` が `pnpm lint` で検査する（`tests/unit/check-boundaries.test.ts` でテスト）。**例外やパターンを足して通さない**。違反したら依存の向きを直す（共有が要るなら `platform` に上げる）。

## アプリの追加・削除

### 追加（フォルダを足すだけ）

`app/apps/<id>/` を作る。ルート・prerender・sitemap・メニュー・ポータルの一覧・規約類の節・API・ビルド後フックは、フォルダの走査で自動で載る。**中央の一覧は編集しない**。

| 置くもの | 必須 | 役割 |
| --- | --- | --- |
| `manifest.ts` | 必須 | `export const manifest = {...} satisfies AppManifest`（型は `app/platform/types.ts`）。`id`・`path`・`name`・`description`（日英）・`category`・`status`（`public` / `beta` / `hidden`。`hidden` は一覧・メニュー・sitemap に出さない）・`icon`・`order`・`menu`（アプリ内のメニュー項目）。データだけを持つ |
| `routes.ts` | 必須 | `appPath`・`createRoutes()`・`allPagePaths()`（sitemap の対象。言語に依存しないパス）・`allBuildPaths()`（prerender の対象）を export する。ルート id は `<id>/<lang>/<ページ>`。日英とも `LANGS` と `LANG_PREFIX`、`createAppPaths()` を使う（markdown-pdf を参照） |
| `layout.tsx` | 実質必須 | `<Shell config={{ appPath, name, menu }}>` で包んで `<Outlet />` を出す |
| `i18n/` | 必須 | `ja.ts`・`en.ts`・`types.ts`・`index.ts`（アプリの文言。`en` は型で縛る。Vitest が日英のキー一致を検査する） |
| `pages/` | 必須 | ページ本体 |
| `public/` | 任意 | `/<path>/` で配信する静的ファイル（アイコン・OGP 画像 `og/{ja,en}.png` 等。`svg`・`png`・`ico`・`webmanifest`・`txt` 以外は `application/octet-stream`） |
| `legal/{privacy,terms}.{ja,en}.mdx` | 任意 | `/privacy/`・`/terms/` にアプリ名の見出しつきで差し込まれる節。無ければ何も出ない |
| `api/index.ts` | 任意 | Hono の `api` と `appPath` を export する。Worker が `/<path>/api/*` に載せる（`wrangler.jsonc` の `run_worker_first` は `/*/api/*`） |
| `build/postbuild.ts` | 任意 | `postbuild(context): Promise<AppBuildResult>` を export する。`scripts/postbuild.ts` が呼ぶ。`_headers` に足すルールを返せる（型は `scripts/lib/postbuild-types.ts`） |
| `site-files.ts` | 任意 | `buildSiteFiles()` が返したファイルを `/<path>/` 以下に出す（image-adjust のマニフェスト） |
| `content/<lang>/*.mdx` | 任意 | 記事。日英で同じファイル名にする（片方だけだとビルドで警告） |
| `tests/` | 任意 | 単体テスト（`app/**/*.test.ts(x)` なので `tests/` の中でも `*.test.ts` なら拾われる） |
| `tests/e2e/*.spec.ts` | 任意 | アプリ固有の E2E（アプリを消せば一緒に消える） |

- `manifest.path` は小文字の英数字とハイフン（`^[a-z0-9]+(?:-[a-z0-9]+)*$`）で、他のアプリと重複しないこと。予約語は使えない：`en`・`assets`・`privacy`・`terms`・`404`・`sitemap.xml`・`robots.txt`・`ads.txt`・`favicon.ico`・`og`（`app/platform/registry/validation.ts` の `RESERVED_APP_PATHS`）。`id` も重複不可。ポータルだけ `path` が空
- `icon` と `category` は `app/platform/types.ts` の許可リスト（`APP_ICON_KEYS`・`APP_CATEGORIES`）から選ぶ。足りなければ `platform` の側に足す（`registry/icons.tsx` も）。**これは中央の一覧への追加が要る唯一の例外**
- 動的セグメント（`:pair` 等）は使わず、値ごとに静的ルートを登録する（「ルートの追加」参照）
- アプリ固有の外部サービスを使うなら、`scripts/lib/csp.ts` の許可リストに足す（CSP は全ページ共通の 1 本）
- ポータルに載せる、このリポジトリ外のシステムは `app/apps/portal/external-links.ts` の `externalLinks` に足す

### 削除（フォルダを消すだけ）

`app/apps/<id>/` を消す。他のアプリ・platform は無傷のはずで、`nix develop -c pnpm check:apps` が「外しても `typecheck`・`build` が通る」ことを確かめる。このアプリの規約の節・sitemap・メニュー・API・ビルド後フックも一緒に消える。

Service Worker を持つアプリ（現状 Image Adjust）は、先に自分を unregister してそのアプリのキャッシュを消すだけの `sw.js` を 1 回デプロイしてから消す。フォルダを消しただけでは、過去の訪問者に古いプリキャッシュが残る。

## 広告の置き方

- 広告枠は `app/platform/ads/AdSlot.tsx` の `<AdSlot format="banner" | "sidebar" | "responsive" | "in-article" slot="..." />` を全アプリで使う（アプリ独自の広告枠は作らない）
- ヘッダー直下のバナーは `Shell` が出す（アプリ側で足さない）。それ以外の位置は各ページが決める
- 入力・ダウンロード・保存・設定の近くには置かない（誤クリック防止。ドロップエリア・「PDF を保存」ボタン・設定パネルの近くなど）
- 高さを先に確保する（CLS 防止）。オフラインでは隠す。印刷では隠す（`print:hidden`）
- 1 ページの広告枠は 3 つ以内に配置する。枠数による描画の制限は行わない。開発時だけ `ads/slot-registry.ts` が実際に表示中の枠を数え、3 つを超えたら `console.warn` を出す（CSS で非表示の枠は除き、画面幅の変更時も確認する）
- AdSense のスクリプト（`adsbygoogle.js?client=…`、`async`・`crossorigin="anonymous"`）は `app/root.tsx` の `<AdSenseScript />`（`ads/AdSenseScript.tsx`・`ads/loader.ts`）が 1 ページで 1 回だけ入れる。ハイドレーション後に `requestIdleCallback`（無ければ `load` 後の `setTimeout`）で読み、オフラインでは読まない。クライアント側遷移では入れ直さない。インラインスクリプトは使わない
- 各枠は画面に近づいてから（IntersectionObserver、rootMargin 200px）、スクリプトの読み込み後に 1 回だけ `adsbygoogle.push({})` する。push は「まだ埋まっていない最初の `ins.adsbygoogle`」を埋めるので、`adsbygoogle` のクラスは push の直前に付ける（画面外の枠を先に埋めない）
- 環境変数（`.env.example`）：`VITE_ADSENSE_CLIENT`（`ca-pub-<数字>`）と、形式ごとの既定の広告ユニット ID `VITE_ADSENSE_SLOT_BANNER`・`_RESPONSIVE`・`_IN_ARTICLE`・`_SIDEBAR`（数字のみ。形式違いは未設定扱い）。`<AdSlot>` は `slot` 省略時に形式の既定 ID を使う（`ads/config.ts`）
- クライアント ID と広告ユニット ID が揃わない枠は、dev で破線のプレースホルダー、本番で非表示

## 構成

- **Vite 8 + React Router 7（framework モード、`ssr: false` + `prerender`）**：全ページ・全言語をビルド時に静的 HTML にする。`basename` は `/`。1 つのビルドにして、React と土台のコードを全アプリで共有する（アプリ間の移動は原則クライアント側。Service Worker の制御下では、Shell の現在のアプリ外へのリンクはクリック時にドキュメントの遷移にする）
- **Hono（Cloudflare Worker、`worker/index.ts`）**：`app/apps/*/api/index.ts` を集めて `/<アプリ>/api/*` に載せる。`wrangler.jsonc` の `assets.run_worker_first`（`/*/api/*`）で API だけ Worker を通し、それ以外は静的アセットを返す。Worker 名は `useful-site`（サイト名と切り離している）
- **`@cloudflare/vite-plugin`**：dev・preview でも Worker を workerd で動かす
- **Tailwind CSS v4**（`@tailwindcss/vite`）＋ shadcn/ui 風の部品（Radix UI）

### 組み合わせの都合で入れている設定（変えるときは注意）

1. **`react-router.config.ts` の `future.v8_viteEnvironmentApi: true`**：`@cloudflare/vite-plugin` と併用するには Vite の Environment API が要る（無いとビルドが manifest を見つけられず失敗する）
2. **`vite.config.ts` のプラグイン順は `reactRouter()` → `cloudflare()`**（MDX は先頭、`siteFilesPlugin()`・`appPublicPlugin()` は末尾）：逆にすると dev で全リクエストが workerd に渡り、ページが 404 になる
3. **`base` は `/`、URL とファイルの置き場所が一致する**：Vite の出力（JS / CSS / WASM は `build/client/assets/`）もプリレンダリング HTML（`build/client/<アプリ>/…`）も URL と同じ配置なので、アセットを移す処理はない。`scripts/postbuild.ts` の役割は ① 共通の 404 ページを `404.html` にして各アプリの配下にも置く（Workers の `not_found_handling: "404-page"` は最も近いディレクトリの 404 を探す）② 使わない SPA フォールバックを消す ③ 全 HTML に CSP の `<meta>` を入れる ④ アプリのビルド後フック（`app/apps/<id>/build/postbuild.ts`）を呼ぶ ⑤ `_headers` を書く
4. **prerender のパスは末尾スラッシュなしで渡す**（各アプリの `routes.ts` の `allBuildPaths()`、規約類は `app/platform/legal/paths.ts`）。付けると本文の無い SPA フォールバックが書き出される
5. **URL は末尾スラッシュ付きに統一**（`/image-adjust/about/`）。Workers の `html_handling: "auto-trailing-slash"` が `/about` を `/about/` にリダイレクトする。サイト内リンク・canonical・hreflang も末尾スラッシュ付きで出す（`createAppPaths()` が返す `localizedPath()` / `withBase()`）
6. Worker の出力先は `vite.config.ts` の `environments.useful_site.build.outDir`（`build/worker`）。環境名は `wrangler.jsonc` の `name` を snake_case にしたもの
7. **Service Worker は `vite-plugin-pwa` ではなく postbuild で作る**（`scripts/lib/service-worker.ts`。呼ぶのは Image Adjust のビルド後フック `app/apps/image-adjust/build/postbuild.ts`）。vite-plugin-pwa は Vite のバンドル完了時に SW を作るが、プリレンダリング HTML はその後に React Router が書き出す。これでは日英の全ページの HTML がプリキャッシュに入らない。そこで postbuild の最後（CSP の meta を入れた後）に、`app/apps/image-adjust/sw/sw.ts` を Vite の build API で IIFE にバンドルし、`workbox-build` の `injectManifest` で `build/client/image-adjust/` の HTML・JS・CSS・WASM 等の一覧を埋め込む。共有の `build/client/assets/` からは、そのアプリの HTML（404.html も起点にする）から到達できるものだけを入れる（`scripts/lib/precache-assets.ts`。HTML と JS / CSS の中に現れるアセットのファイル名を推移的に辿る。Web Worker のチャンク・WASM も含む）。全アプリのルートを列挙する React Router のルートマニフェスト（`window.__reactRouterManifest` を含むファイル）は入れるが中身は辿らない（辿ると全アプリが入る）。プリキャッシュの URL は配信 URL に揃える（`about/index.html` → `/image-adjust/about/`）。サイズ上限で漏れた（警告が出た）ときはビルドを失敗させる。workbox の各パッケージは pnpm の厳格な node_modules では推移的依存として解決できないので、devDependencies に直接入れている。更新通知（prompt）は `workbox-window` で自前で実装している（`app/apps/image-adjust/features/pwa/adapters/pwa-store.ts`）。workbox-window は CommonJS なので、プリレンダリングで読まれないよう動的 import にしている
8. **サイト直下のファイル（`sitemap.xml`・`robots.txt`・`ads.txt`）、各アプリの sitemap、アプリのマニフェストは Vite プラグイン**（`scripts/vite-plugin-site-files.ts`）で作る。ビルドでは `build/client/` に出し、dev でも同じ URL で返す。`sitemap.xml` は索引で、`sitemaps/site.xml`（ポータルと規約類）と各アプリの `/<アプリ>/sitemap.xml` を束ねる（`hidden` のアプリは含めない）。`robots.txt` は `Allow: /` と `Sitemap:`。`ads.txt` は `VITE_ADSENSE_CLIENT` が `ca-pub-<数字>` の形式のときだけ出す。アプリ固有のファイルは `app/apps/<id>/site-files.ts`。postbuild は Node で直接実行するので拡張子なしの import を含む `app/` のモジュールを読めず、ルート定義を使うものはこちらに置く
9. **静的ファイルはアプリの `public/` を `/<アプリ>/` で配信する**（`scripts/vite-plugin-app-public.ts`。許可された一覧だけを出し、dev でも同じ URL で返す。あわせて OGP 画像を持つアプリの一覧を define の `__APP_OG_IMAGE_PATHS__` で渡す）。ルートの `public/` は `favicon.ico` とサイト共通の OGP 画像（`og/`）だけで、ドメイン直下のファイルは上記 8 のプラグインで作る
10. **CSP は各 HTML の `<meta http-equiv="Content-Security-Policy">` ＋ `_headers` の `/*` 1 本**（`scripts/lib/csp.ts`）。プリレンダリング HTML のインラインスクリプトはページごとに違う（React Router のハイドレーション用データ等）ので、postbuild がページごとにハッシュを計算して meta に入れる。`frame-ancestors` 等 meta では効かないものは、`_headers` の `/*` で付ける。同じヘッダーを複数のルールで付けると値が連結されるので、CSP は `/*` にだけ書く（他のルールに書くとビルドが失敗する）。ページが増えても `_headers` のルール数は増えない（`/*`・`/assets/*` ＋アプリのフックが足すルール。上限は 100 件・1 行 2000 文字で、超えるとビルドが失敗する）。インラインスクリプトの CSP ハッシュは自動計算なので手で更新しない

### 設定値

- `SITE_ORIGIN`・`DEFAULT_SITE_ORIGIN`・`SITE_NAME`・サイトのストレージ接頭辞（`site:`）は **`app/platform/config/index.ts` だけ**で定義する。`vite.config.ts`・`react-router.config.ts`・Worker・スクリプトもここから import する。`BASE_PATH` はサイト全体では空文字（アプリごとの接頭辞は `manifest.path` から `createAppPaths()` で得る。image-adjust は `app/apps/image-adjust/shared/config.ts`）
- `SITE_ORIGIN` の既定値は暫定ドメインの `https://t0n03k1.com`（`DEFAULT_SITE_ORIGIN`）。ビルド時に `VITE_SITE_ORIGIN` で上書きできる。ドメインを変えるときは `DEFAULT_SITE_ORIGIN` と `wrangler.jsonc` の `routes` の 2 か所を変える
  - canonical・hreflang・og:url・sitemap が誤ったオリジンを指したまま公開されないよう、3 段で防ぐ。① 本番ビルドで、使うオリジン（`VITE_SITE_ORIGIN`、未設定なら既定値）が仮の値（example ドメイン等）・https 以外・パス付きなら目立つ警告を出す（`scripts/vite-plugin-site-files.ts`。既定値のままなら出ない。検証用の `pnpm build` は止めない）② 公開は **`pnpm run deploy`**（`pnpm deploy` は pnpm 組み込みのコマンドなので `run` を付ける）で行う。最初に `scripts/check-deploy-env.ts` が同じ判定をして問題があれば止め（未設定なら既定値で通す）、通ったら `pnpm build` → `wrangler deploy`。判定は `scripts/lib/site-origin.ts` ③ 環境変数の雛形は `.env.example`（`.env` / `.env.*` は git に入れない）
- 広告：`VITE_ADSENSE_CLIENT`（未設定なら広告枠は dev で破線のプレースホルダー、本番で非表示。`ads.txt` もこの値から作る）
- アクセス解析：`VITE_CF_ANALYTICS_TOKEN`（Cloudflare Web Analytics。設定したときだけビーコンを入れる）
- `wrangler.jsonc` の `run_worker_first`（`/*/api/*`）と `routes` は JSON なので直書きしている。API のパス規約や公開ドメインを変えたらここも変える

### 公開先（暫定ドメイン）

- 公開 URL は `https://t0n03k1.com/`。`wrangler.jsonc` の `routes` は `t0n03k1.com/*` の 1 本（`zone_name: t0n03k1.com`）で、サイト全体を 1 つの Worker が担当する。ドメイン直下（`/robots.txt`・`/ads.txt`・`/sitemap.xml`）もこのリポジトリが出す。dev・preview・E2E は routes を使わない（localhost で配信）
- CI（`ci.yml`）とデプロイ（`deploy.yml`）は、devShell が使う Nix のストアをファイルのバイナリキャッシュにして `actions/cache` でキャッシュする（キーは `flake.nix`・`flake.lock` のハッシュ）。セキュリティ修正版の Node.js は公式のバイナリキャッシュに無くソースからビルドするので、キャッシュが無いと devShell の用意だけで 2 時間近くかかる。`flake.nix`・`flake.lock` を変えた PR と、その後の最初の `main` の CI はこの時間がかかる（PR で保存したキャッシュはその PR の中でしか使えない）
- 自動デプロイ（`.github/workflows/deploy.yml`）は、`main` への push で CI の `verify` が成功したコミットを `pnpm run deploy` で出す。必要な設定は Actions の Secret `CLOUDFLARE_API_TOKEN` と Variable `CLOUDFLARE_ACCOUNT_ID`、有効化の Variable `DEPLOY_ENABLED=true`。デプロイ先は `CLOUDFLARE_ACCOUNT_ID` のアカウント（ローカルは `wrangler login` のアカウント）。`routes` を使うので、ゾーンが同じアカウントにあり、ネームサーバーが Cloudflare を向いている必要がある
- `pnpm run deploy` は、公開オリジン（`VITE_SITE_ORIGIN`、未設定なら既定値）のホストが `routes[].pattern` のホストのどれとも一致しなければ止まる（canonical 等が配信していないホストを指すのを防ぐ。判定は `scripts/lib/site-origin.ts` の `checkOriginMatchesRoutes()`）。routes が無いとき（workers.dev だけで公開）は、`workers_dev` が有効で、オリジンが `*.workers.dev` のときだけ通す
- `workers_dev: false` を明示している（独自ドメインでの公開を確認済み）。wrangler は routes があると workers.dev を既定で無効にするが、明示しておく。ダッシュボード側の設定も次のデプロイでそろう
- ドメインの準備（Cloudflare 側。デプロイ前に済ませる）：t0n03k1.com を Cloudflare のゾーンに追加し、ネームサーバーを切り替える。ルートの Worker はプロキシ（オレンジの雲）されたホスト名でしか動かないので、`t0n03k1.com` の DNS レコード（A / AAAA / CNAME。ドメイン直下を担当するものが無ければ `AAAA t0n03k1.com 100::` のプロキシ有効レコード）を置く
  - Rocket Loader・Bot Fight Mode の JavaScript detections・Email Obfuscation など、HTML を書き換えるゾーンの機能は無効にする（ハッシュ方式の meta CSP とぶつかる。有効にするならデプロイ後に CSP 違反を確かめる）。Always Use HTTPS を有効にする（HSTS は `_headers` で `Strict-Transport-Security: max-age=31536000` を付ける）
- www 付き（`www.t0n03k1.com`）でも開けるよう、プロキシ有効の `www` の DNS レコード（例 `AAAA www 100::`）を置き、Cloudflare の Redirect Rule で `www.t0n03k1.com/*` を `https://t0n03k1.com/$1` へ 301 で転送する（コードでは扱わない。routes は www を含まない）
- workers.dev から独自ドメインへの移行：独自ドメインで全機能が動くのを確認したので、`wrangler.jsonc` の `workers_dev` は `false` にしている（ダッシュボード側も次のデプロイでそろう）。canonical は既に独自ドメインを指しているので、検索結果の重複はこれで解消する。workers.dev は自分のゾーンではないため、Redirect Rules・Bulk Redirects では 301 を返せない。301 が必須なら、Worker でホスト名を見てリダイレクトする実装（`run_worker_first` の範囲の見直しを含む）が別途要る

## ディレクトリ

```
app/
  root.tsx                 共通の <html lang>・テーマのインラインスクリプト・Provider
  routes.ts                app/apps/*/routes.ts を走査してルートを組み立てる（アプリ名を直書きしない）＋ 規約類・404
  app.css
  platform/                土台（どのアプリにも依存しない）
    shell/                 Shell・ヘッダー・ハンバーガーメニュー・フッター・言語切り替え・テーマ切り替え・LocalizedLink・PageHeader・NotFound・画面下の通知（BottomNotices・LangSuggestion）
    registry/              アプリの登録簿（manifest.ts を自動収集）・検証（validation.ts）・アイコン
    i18n/                  ja.ts（正）・en.ts・types.ts・langs.ts・index.ts（仕組みと共通の文言）
    ads/                   広告枠（AdSlot.tsx）・AdSense の読み込み（AdSenseScript.tsx・loader.ts）・設定値（config.ts）・表示枠数の警告（slot-registry.ts）
    analytics/             CloudflareAnalytics
    seo/                   meta ヘルパー・JSON-LD・sitemap の組み立て
    storage/ theme/ ui/    ストレージ・テーマ（tokens.css）・shadcn 風の部品
    state/                 ToolSessionProvider（ツールの作業状態）
    hooks/                 use-online・use-hydrated
    paths/                 createAppPaths（アプリごとの URL の組み立て）
    config/                サイト名・オリジン・ストレージ接頭辞
    content/               MDX の表示（mdx.tsx・prose.css）と、規約類の本文（ja/・en/）
    legal/ pages/          規約類（privacy・terms）のページと、アプリの節の差し込み
    types.ts utils.ts      AppManifest 等の型・cn()
  apps/
    portal/                ルート（/）のアプリ一覧。external-links.ts に外部システム
    image-adjust/          画像調整（domain/・features/{image-processing,icon-generator,remote-image,pwa,guide-content}/・shared/・pages/<ページ>/。下記「アプリ別の注意」）
    markdown-pdf/          Markdown → PDF（domain/・features/{document-input,render,settings,print}/・pages/tool/）
worker/                    Hono の入口（index.ts）と Env 型（env.ts）。API は各アプリの api/ から集める
scripts/
  postbuild.ts             ビルド後の整形（404・CSP の meta・アプリのフック・_headers）
  check-boundaries.ts      依存の境界の検査（pnpm lint から）
  check-app-removal.ts     アプリを外したビルドの検査（pnpm check:apps）
  check-deploy-env.ts      pnpm run deploy の前提の検査
  generate-og-images.ts    アプリとサイト共通の OGP 画像の生成
  vite-plugin-site-files.ts  sitemap・robots.txt・ads.txt・アプリのサイトファイル・記事の訳し漏れ警告
  vite-plugin-app-public.ts  アプリの public/ の配信
  lib/                     csp.ts・service-worker.ts・precache-assets.ts（プリキャッシュするアセットの到達判定）・site-origin.ts・ads-txt.ts・app-routes.ts（アプリのルートの収集）・app-og-images.ts（OGP 画像の規約と有無）・postbuild-types.ts
public/                    favicon.ico とサイト共通の OGP 画像 og/（ドメイン直下）
tests/unit, tests/e2e      サイト共通の Vitest・Playwright
```

## 開発の取り決め

### ツールの状態は `useToolSession()` に置く

言語切り替えは同じページの他言語版へのクライアント側遷移で、ルート id が変わるのでルートのコンポーネントは作り直される。画像・設定・結果を失わない（image-adjust の仕様）ために、**ツールの状態はルートコンポーネントの `useState` ではなく `app/platform/state/ToolSessionProvider.tsx` の `useToolSession(key, initial)` に置く**。キーにはアプリ名またはツール名の接頭辞を付ける（例 `convert:files`、`icons:settings`）。`File` / `Blob` もそのまま置ける。再読み込みでは消える（保存しない）。`useToolSessionStore().clear("convert:")` でまとめて消せる。`initial` は key ごとに扱う（同じコンポーネントのまま key が変わったら、その時点の `initial` を使う）。

### i18n

- 共通の文言は `app/platform/i18n/ja.ts` に足し、同じキーを `en.ts` に足す。アプリの文言は `app/apps/<id>/i18n/ja.ts`・`en.ts`（`en` は `satisfies Dictionary` なので、足りない・余分なキーは型エラー）
- 共通の文言は `const { t, lang } = useI18n()`（`~/platform/i18n`）→ `t("nav.convert")`、置換は `t("pages.convert.title", { from, to })`（辞書側は `{from}`）。アプリの文言は各アプリの `i18n/index.ts`（markdown-pdf は `useMdI18n()`）
- React の外（`meta()` 等）では `createT(lang)` / `translate(lang, key)`
- 数値・サイズは `formatNumber(lang, n)` / `formatBytes(lang, bytes)`
- サイト内リンクは `<LocalizedLink page="...">`（表示中の言語・アプリの URL になる）。パスの組み立ては `createAppPaths(manifest.path)` の `localizedPath(lang, page)`
- Vitest が日英のキー一致と置換変数の一致を検査する（platform と各アプリ）

### ルートの追加（アプリ内のページ）

1. `app/apps/<id>/pages/<ページ>/route.tsx` にページを作る（`meta()` は `buildPageMeta()` を返す。既存ページを参照）
2. そのアプリの `routes.ts` の `pages()` に `route(...)` を足す（日英の両方が生成される）
3. 同じ `routes.ts` の `allPagePaths()`（sitemap・prerender の対象）に足す
- 動的セグメント（`:pair` 等）は使わない。変換・圧縮・解説は `CONVERT_PAIRS`・`COMPRESS_FORMATS`・`GUIDE_SLUGS`（`app/apps/image-adjust/domain/pages.ts`）の値ごとに静的ルートを登録し（同じモジュールを `image-adjust/ja/convert/png-to-webp` 等の別 id で）、ページ側は `pageParam(pathname, "convert")`（`shared/site-routes.ts`）でパスから値を取り出す。動的ルートだと不正な値（`/image-adjust/convert/bogus/`）で、配信される 404.html とクライアントのマッチが食い違い、ハイドレーションに失敗する。静的ルートなら不正な値は splat（not-found）に落ちる
4. メニューに出すなら `manifest.ts` の `menu` と辞書に足す

### SEO

- 各ルートの `meta({ location })` で `buildPageMeta({ lang, page, title, description, ... })` を返す。title・description・canonical・OGP・Twitter・hreflang（ja / en / x-default）・パンくずの JSON-LD が絶対 URL で入る。共通の部品は `app/platform/seo/`、image-adjust は自アプリ用の `app/apps/image-adjust/shared/seo/`
- 追加の構造化データは `jsonLd: [webApplicationJsonLd(...)]` / `articleJsonLd` / `faqJsonLd`（`json-ld.ts`）。本文中に置くなら `<JsonLd data={...} />`
- **OGP 画像**（1200×630、言語ごとに 1 枚）：`buildPageMeta()` は `image` 省略時に、そのページのアプリの `app/apps/<id>/public/og/<lang>.png`（`/<アプリ>/og/<lang>.png`）を、アプリが日英とも持っていなければサイト共通の `public/og/<lang>.png`（`/og/<lang>.png`。ポータル・規約類・404）を使う。有無は `scripts/lib/app-og-images.ts` が調べ、仮想モジュール `virtual:app-og-images` で渡す（vitest も同じプラグイン）。dev では `public/og/` の画像の追加・削除で再計算してリロードする。生成は `nix develop -c node scripts/generate-og-images.ts`（manifest の name・description、platform のアイコン対応表 `registry/icon-components.ts`、`SITE_NAME` から、Playwright の Chromium で描く）。アプリが自前の `scripts/generate-og-images.ts` を持つならそのアプリは飛ばす（Image Adjust はロゴ入りの独自デザイン）。アプリを足したら実行して PNG をコミットする（`tests/unit/og-images.test.ts` が全アプリの画像の有無と大きさを、`tests/e2e/og-images.spec.ts` が全ページの og:image の実在を確かめる）。manifest の name・description を変えたときも作り直す

### テーマ・デザイン

- 色は `app/platform/theme/tokens.css` の CSS 変数だけで定義し、Tailwind からは `bg-background`・`text-muted-foreground`・`border-border`・`bg-surface`・`text-success` 等で参照する。`dark:` は `<html data-theme="dark">` に紐付いている
- 透過画像の背景は `bg-checker`（市松模様、テーマで濃淡が変わる）
- インラインスクリプト（`THEME_INIT_SCRIPT` 等）の CSP ハッシュはビルド時に自動で計算する（手で更新しなくてよい）。外部スクリプトや iframe を足すときは `scripts/lib/csp.ts` の許可リストに足す
- タップ領域は 44px 以上（`Button` の既定サイズは h-11）
- ヘッダーは固定（h-14）。アンカーやスキップリンクの移動先が隠れないよう `html` に `scroll-padding-top` を付けている（`app/app.css`）。記事の見出しの `scroll-margin-top`（`app/platform/content/prose.css`）はこれに足される余白
- 画面下に重ねて出す通知（言語の案内 `LangSuggestion`・PWA の更新／受け取り件数 `PwaRoot`）は、`app/platform/shell/BottomNotices.tsx` の固定コンテナ 1 つに `<BottomNotice>` でポータルして縦に積む（別々に fixed にすると重なって押せなくなる。ページの流れに入れると CLS）。位置は `bottom-above-action-bar`（スマホのツール画面の下固定バー `data-mobile-action-bar` の上）。何か出ている間はコンテナの実際の高さ（ResizeObserver → `--bottom-notices-height`）だけ body の下に余白を足し、フッターを隠さない。画面下の通知を足すときもここに入れる

### UI 部品（`app/platform/ui/`）

`button`（`buttonVariants`・`asChild`）・`card`・`input`・`label`・`slider`・`select`・`tabs`・`switch`・`checkbox`・`radio-group`・`toggle-group`・`dialog`・`sheet`（下から出るシート。`side="bottom"` が既定）・`dropdown-menu`・`progress`・`badge`（`success` / `warning` / `destructive`）・`tooltip`。クラスの結合は `cn()`（`app/platform/utils.ts`）。

### ストレージ

`localStorage` は直接使わず `app/platform/storage/index.ts`（`getItem` / `setItem` / `getJSON` / `setJSON`）を使う。キーには自動で接頭辞が付く（サイト共通は `site:`、image-adjust は `app/apps/image-adjust/shared/config.ts` の `STORAGE_PREFIX` = `image-adjust:`）。使うキーは `STORAGE_KEYS` に足す。Cache Storage・IndexedDB の名前にも同じ接頭辞を付ける。

### 依存

必要な依存はすべて入れてある（jSquash・libimagequant-wasm・image-q・gifsicle-wasm-browser・svgo・fflate・comlink・markdown-it・markdown-it-footnote・@mdit/plugin-tasklist・workbox-build・workbox-window・@mdx-js/rollup・remark-gfm・happy-dom・@testing-library/react 等）。並列作業で lock が衝突するので、追加が必要なら理由を添えて相談する。

### その他

- E2E の 404 テスト：dev サーバーでは存在しないパスも 200 で返る（404.html はビルド後にだけある）。404 の確認は preview で行う
- `vite-plugin-pwa` は使っていない（「組み合わせの都合」7）。SW は本番ビルド（preview を含む）でだけ登録する。dev には sw.js が無い
- Service Worker は Image Adjust だけが持つ（スコープ `/image-adjust/`）。ドメイン直下（`/`）には置かない
- Shell のアプリ間・規約類のリンクは、クリック時に Service Worker の controller があれば `window.location.assign()` で遷移する（他アプリのチャンクはプリキャッシュしないため）。修飾キー・中クリック・target 指定は既定の動作に任せ、描画する要素・属性は変えない

### 記事（MDX）

- 各アプリの `content/<lang>/<name>.mdx`（image-adjust のガイド・about 等）。日英で同じファイル名にする（片方しか無いとビルドで警告、Vitest で失敗）。サイト共通の規約類は `app/platform/content/<lang>/{privacy,terms}.mdx`、アプリ固有の節は `app/apps/<id>/legal/{privacy,terms}.{ja,en}.mdx`
- 先頭で `export const frontmatter = { title, description, datePublished, dateModified }` を出す（YAML は使えない）。title がページの h1 と `<title>` になる。本文の見出しは h2 から
- サイト内リンクは、そのアプリの `/<アプリ>` と言語接頭辞なしのページパスで書く（image-adjust なら `[変換](/convert/png-to-webp/)`）。表示中の言語の URL に直る。サイト共通の規約類へは `/privacy/`・`/terms/`
- 本文中（コードブロックの外）に `{` `}` `<` を素で書かない（JSX として解釈される）。見た目は `app/platform/content/prose.css`
- フッターの「外部送信について」は `/privacy/` の `<h2 id="external-transmission">` へのリンク（`EXTERNAL_TRANSMISSION_ANCHOR`、`app/platform/legal/paths.ts`）

## アプリ別の注意

### Image Adjust（`app/apps/image-adjust/`、`/image-adjust/`）

画像の変換・圧縮・アイコン生成。ブラウザ内処理。仕様はローカルの `docs/plan.md`。

- 構成（markdown-pdf と同じ。`features/<機能>/{core,adapters,ui,index.ts}`）
  - `domain/`：形式（`format.ts`。MIME・拡張子・先頭バイトでの判定）・上限（`limits.ts`）・ファイル名の無害化（`naming.ts`）・ページの値の一覧と表示名（`pages.ts`。`CONVERT_PAIRS`・`COMPRESS_FORMATS`・`GUIDE_SLUGS`・`FORMAT_LABEL`）・URL 入力の失敗の種類（`remote-image.ts`）
  - `features/image-processing/`：変換・圧縮。`core/`（設定と結果の型 `types.ts`・プリセット・目標サイズの探索・ヘッダーからの寸法・ZIP 内パスの正規化）・`adapters/`（`codecs/`（jSquash・gifsicle・SVGO・libimagequant・メタデータ）・`process.ts`・`processor.ts`（Worker プール）・`image.worker.ts`・`archive/`（ZIP の入出力・ダウンロード）・`engine.ts`（処理の進行）・`preview.ts`・`collect-files.ts`・`tool-types.ts`（画面の状態の型））・`ui/`（`ImageTool`・`SettingsPanel`・`ResultList`・`CompareDialog`・`SnippetDialog`・`FileInput`・`ToolFaq`・`use-image-tool`）
  - `features/icon-generator/`：アイコン生成。`core/`（サイズ・配置・ICO・マニフェスト・HTML スニペット・設定・画像ヘッダー）・`adapters/`（canvas 描画・SVG・元画像の読み込み・ZIP・`generate.ts`）・`ui/`（`IconTool` 等）
  - `features/remote-image/`：URL 入力（Worker の中継 API の呼び出しとファイル名の決定）。`index.ts` の `remoteImageLoader` をページが `ImageTool` の `remoteImage` に渡す
  - `features/pwa/`：Service Worker の登録と更新通知（`pwa-store.ts`）・共有受け取り（`shared-files.ts`）・`InstallPrompt`・`PwaRoot`
  - `features/guide-content/`：MDX の記事（解説・about）の表示（`ContentPage`）
  - `shared/`：`config.ts`（`BASE_PATH`・`STORAGE_PREFIX` 等）・`pwa.ts`（PWA の定数。SW にもバンドルされる）・`web-manifest.ts`・`site-routes.ts`（`pageParam`・prerender と sitemap のパス）・`incoming-files.ts`（共有受け取り → ツールへの受け渡し口）・`seo/`・`logo.ts`・`layout/`（`LogoMark`・フッターの項目）
  - `pages/<ページ>/route.tsx`：`home`・`convert`・`compress`・`icons`・`guide-index`・`guide-article`・`about`・`not-found`（`not-found` はどのルートからも使っていない）
  - アプリ直下：`manifest.ts`・`routes.ts`・`layout*.tsx`・`i18n/`・`api/`・`sw/`・`build/postbuild.ts`・`site-files.ts`・`legal/`・`content/`・`public/`・`scripts/`・`tests/`（E2E は `tests/e2e/`）
- ファイル名の無害化は `domain/naming.ts` の `sanitizeFileName` / `sanitizePath` に集約する
- 入力サイズ・枚数・ピクセル数などの上限は `domain/limits.ts`。URL 入力（Worker の中継 API 経由の取得とファイル名の決定）は `features/remote-image/`。API は `api/`（`fetch-image`・`health`。URL 検証・回数制限つき。回数制限は `wrangler.jsonc` の `ratelimits`）
- プレビュー用の Blob は判定した形式の MIME で作り直す。形式が不明なら表示しない。`fetch-image` は回数制限のバインディングが無ければ `upstream_error` を返す（localhost・127.0.0.1・[::1] の dev・preview は例外）
- **Web Worker・WASM**：Worker は `features/image-processing/adapters/processor.ts` で `new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" })` の形で作り（Vite が検出できるようこの形を保つ）、`comlink` の `wrap` / `expose` で呼ぶ（`vite.config.ts` の `worker.format` は `es`）。jSquash（`@jsquash/*`）は Worker 内で普通に `import { encode } from "@jsquash/webp"` すればよい。WASM は Vite が `assets/` に出力する。WASM とコーデックは画像が入力されたときに動的 import する（初回表示に含めない）。PNG 減色は `libimagequant-wasm`（Worker 対応）を第一候補、`image-q`（純 JS）を代替として入れてある。dev で初めて読み込む依存があると Vite の依存最適化で 1 回再読み込み（504 Outdated Optimize Dep）が起きることがある。気になるなら `optimizeDeps.include` に足す
- **PWA**
  - Service Worker：`/image-adjust/sw.js`、スコープ `/image-adjust/`（定数は `shared/pwa.ts`）。プリキャッシュだけで、ランタイムキャッシュは持たない（広告・解析・`/image-adjust/api/` はキャッシュしない）。キャッシュ名は `image-adjust-precache-…`、古いキャッシュの削除も `image-adjust-precache-` で始まるものだけ。`sw.js` は `_headers` で `Cache-Control: no-cache`（ビルド後フックが足す）
  - 更新：新しい版が待機中なら「更新があります」→「再読み込み」で SKIP_WAITING → 切り替わったら再読み込み。他のタブで先に切り替わったときは、作業中の画像を失わせないため自動では再読み込みせず「再読み込みしてください」と案内する（`features/pwa/adapters/pwa-store.ts`）
  - 共有受け取り：マニフェストの `share_target`（POST `/image-adjust/share-target`）を SW が受けて Cache Storage（`image-adjust:share-target`）に一時保存し、`/image-adjust/?share=1`（英語は `/image-adjust/en/?share=1`）にリダイレクトする。ページ側の `features/pwa/ui/PwaRoot.tsx` が取り出して `pushIncomingFiles()`（`shared/incoming-files.ts`）に渡し、キャッシュを消す。`file_handlers`（launchQueue）も同じく `pushIncomingFiles()` に渡す。ツール側は `subscribeIncomingFiles()` で受け取る
  - 共有受け取りは他サイトからのフォーム POST を受け取らない（`Sec-Fetch-Site` が `none`（OS の共有）・`same-origin` 以外なら保存せずリダイレクトだけ。ヘッダーが SW に見えない環境では Referer のオリジンで判定）。**未確認：Android 実機の共有で `Sec-Fetch-Site: none`（またはヘッダー無し・Referer 無し）になること**
  - 共有で一時保存するファイルは、通常のファイル入力と同じ MIME・拡張子の集合（ZIP を含む）に絞る。マニフェストの accept も同じ集合にする
  - マニフェスト（日英）は `site-files.ts` → `shared/web-manifest.ts` で作る
- **OGP 画像**：`public/og/<lang>.png`（1200×630、言語ごとに共通の 1 枚。ロゴ入りの独自デザインなので、サイト共通の `scripts/generate-og-images.ts` の対象外）。`buildPageMeta()` が `image` 省略時に自動で付ける。作り直しは `nix develop -c node app/apps/image-adjust/scripts/generate-og-images.ts`（Playwright の Chromium で描画）
- **ロゴ**：図形は `shared/logo.ts` だけで定義する（角丸の正方形の面に、山と太陽の写真マークと調整スライダーを抜いた形。32 の格子で 16px でも潰れないように設計）。ヘッダーは `shared/layout/LogoMark.tsx`（インライン SVG。面は `currentColor`、記号は背景色のトークンで塗るので、テーマに合わせて白黒が反転する）。単体のファイルは `public/logo.svg`（黒地に白）
- **アイコン**：`public/favicon.ico`・`favicon.svg`・`apple-touch-icon.png`・`public/pwa/icon-*.png`（すべて `/image-adjust/` 配下で配信）。ロゴを元に、アイコン生成ツール（`features/icon-generator/`。`scripts/lib/icon-generator-entry.ts` はその `index.ts` から読む）と同じ処理で作る。ロゴを変えたら `nix develop -c node app/apps/image-adjust/scripts/generate-icons.ts`（`public/logo.svg` とアイコン）→ `nix develop -c node app/apps/image-adjust/scripts/generate-og-images.ts`（OGP 画像）で作り直す。16px・32px での見え方は `/image-adjust/icons/` ページに `public/logo.svg` を入れるとライト・ダークのタブで確かめられる。`public/icons/` はアイコン生成ページ（`/image-adjust/icons/`）と衝突するので使わない
- テスト画像は `tests/fixtures/`（`generate-fixtures.ts` で作る）。ブラウザ用コーデックを Node で動かす補助は `tests/helpers/codecs-node.ts`、GIF のフレーム数等を読む検証用の補助は `tests/helpers/gif-info.ts`

### Markdown → PDF（`app/apps/markdown-pdf/`、`/markdown-pdf/`）

Markdown をブラウザ内で整え、**ブラウザの印刷で PDF にする**（PDF 生成ライブラリは使わない）。仕様はローカルの `docs/markdown-pdf-plan.md`。構成の手本（`domain/`・`features/{document-input,render,settings,print}/{core,adapters,ui,index.ts}`・`pages/tool/`）。

- 変換は `markdown-it`（`html: false`。生の HTML はすべて文字として表示し、危険な URL はリンクにしない）＋ `markdown-it-footnote`・`@mdit/plugin-tasklist`。使う瞬間に動的 import する（`features/render/adapters/`）
- プレビュー（＝印刷する文書）は `sandbox="allow-same-origin allow-modals"` の iframe（`srcdoc`）。`allow-scripts` は付けない（`features/print/adapters/frame.ts`）。iframe の中に `<meta http-equiv="Content-Security-Policy">` を入れ、外部への通信を禁止する（`default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'`。`features/print/core/document.ts`）。ページ本体の CSP（広告のために外部画像を許可）とは別に絞っている。sandbox や CSP を緩めない
- iframe 内のリンクのクリックは親で扱う（sandbox に `allow-popups` が無く、`srcdoc` の基底 URL が親のページのため。`frame.ts`）
- 同梱した SVG 画像（拡張子 `.svg` または MIME `image/svg+xml`）は、固定 MIME の `data:image/svg+xml;base64,...` にする。それ以外の画像は、受け付ける拡張子から決めた固定 MIME の Blob に作り直して blob: URL を使う。未対応の拡張子は URL を作らない
- 広告は印刷されない（印刷されるのは iframe の中身だけ。念のため `print:hidden` でも隠す）。入力の上限は `domain/limits.ts`

## 未解決の注意

- `/assets/*` は存在しないファイルの 404 にも immutable のキャッシュが付く。`wrangler rollback` で旧版に戻した直後にその 404 を受け取った利用者は、旧チャンクを読めない
- Service Worker が無い状態（サイトデータを消した後）で OS の共有を使うと、`POST /image-adjust/share-target` は 405 になる
- お問い合わせは GitHub の Issue（`https://github.com/katoline/useful-site/issues`）で受け付ける。Issue は公開されるので、規約・about に「個人情報を書かない」旨を書いてある（`app/platform/content/{ja,en}/privacy.mdx` の「個人情報の取り扱い」）
- サイト名（`SITE_NAME`）は仮。決まったら `app/platform/config/index.ts` を変える
- Android 実機の共有受け取りの `Sec-Fetch-Site` は未確認（Image Adjust の PWA の項）
