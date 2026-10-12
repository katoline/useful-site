# Image Adjust

Web サイト・LP 制作で使う画像を、ブラウザの中だけで変換・圧縮・最適化できるツールです。画像はサーバーに送らず、WASM と Web Worker で処理します。PNG / JPEG / WebP の相互変換、圧縮（品質・目標ファイルサイズ・リサイズ）、GIF / SVG の最適化、ZIP の一括処理、Web 用アイコン一式（ファビコン等）の生成に対応しています。日本語と英語、ライトとダーク、PWA（インストール・オフライン動作）に対応し、`/image-adjust/` 以下に配置して公開します。

## 技術スタック

- TypeScript、React 19、React Router 7（framework モード。全ページ・全言語をビルド時に静的 HTML にする）
- Vite 8、Tailwind CSS 4、shadcn/ui 風の部品（Radix UI）
- Hono（Cloudflare Worker。URL 入力のための画像取得の中継 API）、Wrangler
- 画像処理：jSquash（MozJPEG・libwebp・OxiPNG）、libimagequant-wasm、gifsicle-wasm-browser、SVGO、fflate、Comlink
- PWA：Workbox（Service Worker を postbuild で生成）
- テスト・品質：Biome、Vitest、Playwright
- 開発環境：Nix の devShell（Node.js 22・pnpm・Playwright のブラウザ）と direnv

## ディレクトリ構成

```
app/               フロントエンド（ルート・UI 部品・i18n・テーマ・画像処理・アイコン生成）
content/           解説ページ・規約類の MDX（ja / en）
worker/            Cloudflare Worker（Hono）
sw/                Service Worker
scripts/           ビルド後の整形・アイコン / OGP 画像の生成・公開前の確認
public/            アイコン・OGP 画像
tests/             Vitest（unit）・Playwright（e2e）
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
| `dev` | 開発サーバー（http://localhost:5173/image-adjust/） |
| `preview` | ビルド済みの成果物を workerd で配信（http://localhost:4173/image-adjust/） |

### 検証

| コマンド | 内容 |
| --- | --- |
| `lint` | Biome（lint・書式・import の並び） |
| `lint:fix` | Biome の自動修正 |
| `format` | Biome で整形 |
| `typecheck` | 型生成と `tsc`（app・worker・sw） |
| `test` | Vitest |
| `test:e2e` | Playwright（ビルドしてから preview を起動。PC とスマホ表示） |

### ビルド・公開

| コマンド | 内容 |
| --- | --- |
| `build` | 本番ビルド（プリレンダリング・Worker・Service Worker） |
| `run deploy` | 公開前の確認 → ビルド → `wrangler deploy`。公開オリジンが仮の値や Worker の routes と食い違うときは止まる |
