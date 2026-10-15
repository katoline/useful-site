# useful-site

1 つのドメイン（https://t0n03k1.com）に、ブラウザの中だけで動く便利なアプリを多数載せるサイトです。ポータル（アプリの一覧）が `/`、各アプリが `/<アプリ>/` で、英語版はアプリのパスの内側に `/en/` を付けた URL です。アプリは `app/apps/<id>/` のフォルダを足す・消すだけで差し込めます。

現在のアプリ：

- **portal**（`/`）：アプリの一覧
- **image-adjust**（`/image-adjust/`）：画像の変換・圧縮・最適化、ZIP の一括処理、Web 用アイコン一式の生成。画像はサーバーに送らず、WASM と Web Worker で処理します。PWA（インストール・オフライン動作）に対応しています
- **markdown-pdf**（`/markdown-pdf/`）：Markdown を整えて、ブラウザの印刷で PDF にします
- **qr-code**（`/qr-code/`）：URL から QR コードを生成します。中央に汎用アイコン・サービスロゴ・自分の画像（PNG・JPEG・WebP）を埋め込め、PNG と SVG で保存できます。処理はブラウザの中だけで完結します

日本語と英語、ライトとダークに対応しています。

## 技術スタック

- TypeScript、React 19、React Router 7（framework モード。全ページ・全言語をビルド時に静的 HTML にする）
- Vite 8、Tailwind CSS 4、shadcn/ui 風の部品（Radix UI）
- Hono（Cloudflare Worker。各アプリの API を集めて配信する。image-adjust の URL 入力のための画像取得の中継 API など）、Wrangler
- 画像処理：jSquash（MozJPEG・libwebp・OxiPNG）、libimagequant-wasm、gifsicle-wasm-browser、SVGO、fflate、Comlink
- Markdown：markdown-it
- QR コード：qrcode（純 JavaScript。ブラウザ内で符号化する）、Simple Icons（サービスのロゴ）
- PWA：Workbox（image-adjust の Service Worker を postbuild で生成）
- テスト・品質：Biome、Vitest、Playwright
- 開発環境：Nix の devShell（Node.js 22・pnpm・Playwright のブラウザ）と direnv

## ディレクトリ構成

```
app/
  platform/        土台（シェル・アプリの登録簿・i18n・広告枠・SEO・UI 部品）。どのアプリにも依存しない
  apps/<id>/       アプリ（portal・image-adjust・markdown-pdf・qr-code）。文言・ページ・ルート・API・テスト等を全部この中に置く
worker/            Cloudflare Worker（Hono）。各アプリの api/ を集める
scripts/           ビルド後の整形・依存の境界の検査・OGP 画像の生成・公開前の確認
public/            favicon とサイト共通の OGP 画像
tests/             サイト共通の Vitest（unit）・Playwright（e2e）
```

詳しい構成と開発の取り決めは [AGENTS.md](AGENTS.md) にあります。

## セットアップ

Nix と direnv が入っていれば、リポジトリに入ると devShell が有効になります（初回は `direnv allow`）。direnv を使わない場合は、コマンドの前に `nix develop -c` を付けます。

```sh
nix develop -c pnpm install
```

環境変数は任意です。必要なら `.env.example` を `.env` にコピーして設定します（`VITE_SITE_ORIGIN`・`VITE_ADSENSE_CLIENT`・`VITE_CF_ANALYTICS_TOKEN`）。

## コマンド

以下は `nix develop -c pnpm <コマンド>` の形で実行します。

### 開発

| コマンド | 内容 |
| --- | --- |
| `dev` | 開発サーバー（http://localhost:5173/） |
| `preview` | ビルド済みの成果物を workerd で配信（http://localhost:4173/） |

### 検証

| コマンド | 内容 |
| --- | --- |
| `lint` | Biome（lint・書式・import の並び）と依存の境界の検査 |
| `lint:fix` | Biome の自動修正（境界の検査は含まない） |
| `format` | Biome で整形 |
| `typecheck` | 型生成と `tsc`（app・worker・sw） |
| `test` | Vitest |
| `test:e2e` | Playwright（ビルドしてから preview を起動。PC とスマホ表示） |
| `check:apps` | ポータル以外のアプリを外した状態でも `typecheck`・`build` が通るかを確かめる |

### ビルド・公開

| コマンド | 内容 |
| --- | --- |
| `build` | 本番ビルド（プリレンダリング・Worker・各アプリのビルド後フック） |
| `run deploy` | 公開前の確認 → ビルド → `wrangler deploy`。公開オリジンが仮の値や Worker の routes と食い違うときは止まる |
