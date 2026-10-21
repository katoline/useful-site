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

### 自動デプロイ

`main` にマージ（push）して CI の `verify` が成功すると、`.github/workflows/deploy.yml` がそのコミットで `pnpm run deploy` を実行します。CI が失敗したコミットはデプロイしません。Actions の画面から手動で流すこともできます（`workflow_dispatch`）。

初回だけ、リポジトリの Settings → Secrets and variables → Actions に次を登録します（値はデプロイ先の Cloudflare アカウントのもの）。

| 種別 | 名前 | 内容 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | 「Edit Cloudflare Workers」テンプレートで作った API トークン |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | アカウント ID（`wrangler whoami` で確認） |
| Variable | `DEPLOY_ENABLED` | `true` にすると自動デプロイが有効になる。準備が済むまでは未設定（skip） |
| Variable | `VITE_ADSENSE_CLIENT` ほか `VITE_ADSENSE_SLOT_*` | 任意。広告を出すときだけ（`.env.example` を参照） |
| Variable | `VITE_CF_ANALYTICS_TOKEN` | 任意。Cloudflare Web Analytics を使うときだけ |

`CLOUDFLARE_API_TOKEN` は Account の `Workers Scripts: Edit`、Zone の `Workers Routes: Edit` と `Zone: Read` があれば足ります（「Edit Cloudflare Workers」テンプレートはこれを含みます）。`VITE_SITE_ORIGIN` は設定しないでください（未設定なら既定値が `wrangler.jsonc` の routes と一致します）。

`wrangler.jsonc` の `routes` を使うため、ドメインのゾーンが同じ Cloudflare アカウントにあり、ネームサーバーが Cloudflare に向いている必要があります。ローカルからのデプロイ先は `wrangler login` したアカウント、CI からのデプロイ先は `CLOUDFLARE_ACCOUNT_ID` のアカウントです（両方を同じアカウントにそろえる）。

初回は次の順で行います。

1. `tonosaki.sub@gmail.com` のアカウントで API トークンを作り、アカウント ID を控える
2. GitHub に `CLOUDFLARE_API_TOKEN`（Secret）・`CLOUDFLARE_ACCOUNT_ID`（Variable）を登録する
3. `t0n03k1.com` のゾーンを同じアカウントに追加し、ネームサーバーを Cloudflare に向けて Active にする
4. `deploy.yml` を main にマージする（`DEPLOY_ENABLED` が未設定なので、この時点ではデプロイは skip）
5. `DEPLOY_ENABLED=true` を登録し、Actions → Deploy → Run workflow で 1 回流して確認する。以降は main へのマージで自動デプロイ

### 公開後の TODO

#### 現在の状態（2026-10-21）

| 項目 | 状態 |
| --- | --- |
| 公開 | `https://t0n03k1.com/`（Cloudflare、apex のみ。www は未設定） |
| Worker | `useful-site`。route は `t0n03k1.com/*`、workers.dev は無効 |
| 自動デプロイ | 有効（`DEPLOY_ENABLED=true`） |
| AdSense | `VITE_ADSENSE_CLIENT` 設定済み・`/ads.txt` 公開済み・審査中。`VITE_ADSENSE_SLOT_*` は未設定、CMP は未確認 |
| Cloudflare Web Analytics | 未設定 |
| 監視・アラート | 未設定 |
| www | 未設定 |
| Search Console | サイトマップ送信済み、インデックス反映待ち |

#### 1. www（`www.t0n03k1.com`）を設定する（任意）

現状は apex のみで、`www` の DNS レコードも Redirect Rule もありません。使わない場合はこの手順を飛ばして構いません。

1. Cloudflare → `t0n03k1.com` → **DNS** → **Records**
2. **Add record**
   - Type: `AAAA`
   - Name: `www`
   - IPv6 address: `100::`
   - Proxy status: **Proxied**
   - TTL: Auto
3. **Rules** → **Overview** → **Create rule** → **Redirect Rule**
   - Rule name: `www to apex`
   - When incoming requests match: **Wildcard pattern**
   - Request URL: `https://www.t0n03k1.com/*`
   - Then: Target URL `https://t0n03k1.com/${1}`、Status code `301`、Preserve query string On
4. **Deploy**
5. 確認

```sh
curl -I https://www.t0n03k1.com/
curl -I https://t0n03k1.com/
```

`www` が 301 で apex に転送され、apex が 200 ならOKです。

#### 2. 監視・アラートを設定する（任意）

**Cloudflare Alerts**

1. `https://dash.cloudflare.com/?to=/:account/notifications` を開く
2. **Add** を押す
3. Workers 関連のアラート（Worker のエラー・失敗など）を選ぶ
4. 通知先（メールなど）を設定する

**外部の uptime 監視**

UptimeRobot・Better Stack などで次を5分間隔で監視します。

- `https://t0n03k1.com/`（HTTP 200）
- `https://t0n03k1.com/image-adjust/api/health`（HTTP 200、本文に `"ok":true`）

**Search Console の通知**

GSC → **Settings** → **Email notifications** を On にします。

#### 3. Cloudflare Web Analytics を設定する（任意）

1. `https://dash.cloudflare.com/?to=/:account/web-analytics` を開く
2. **Add a site**
3. ドロップダウンから `t0n03k1.com` を選ぶ → **Done**

プロキシ済みのサイトは**自動設定が既定で有効**です。数分後にデータが出ます。

自動設定でデータが出ない場合は、GitHub の Variables に `VITE_CF_ANALYTICS_TOKEN` を追加して再デプロイします。このサイトはトークンが設定されたときだけビーコンを入れます。

#### 4. AdSense を有効にする（審査中）

初回の設定（パブリッシャー ID・`ads.txt`・サイト認証）は、下の「広告（AdSense）」の節を参照してください。ここでは審査後に行う作業をまとめます。

##### 4-1. 広告ユニットを作る

AdSense → **Ads** → **By ad unit** → **Create ad unit** で4つ作ります。

| サイトの形式 | AdSense の種類 | GitHub Variable |
| --- | --- | --- |
| ヘッダー下のバナー | Display ads（レスポンシブ） | `VITE_ADSENSE_SLOT_BANNER` |
| ページ内の横長枠 | Display ads（レスポンシブ） | `VITE_ADSENSE_SLOT_RESPONSIVE` |
| 記事内 | In-article ads | `VITE_ADSENSE_SLOT_IN_ARTICLE` |
| サイドバー | Display ads（縦長・レスポンシブ） | `VITE_ADSENSE_SLOT_SIDEBAR` |

各ユニットの `data-ad-slot="1234567890"` の**数字10桁**を、対応する Variables に登録します。

https://github.com/katoline/useful-site/settings/variables/actions

##### 4-2. CMP を設定する

EEA・英国・スイス向けの同意管理が必要です。

1. AdSense → **Privacy & messaging**
2. **European regulations** → **CMP**
3. CMP を作成し、対象地域（EEA・英国・スイス）と言語（日本語・英語）を設定
4. メッセージを公開

##### 4-3. Auto ads を Off にする

このサイトは `AdSlot` で手動配置しているため、Auto ads は Off にします。

- AdSense → **Ads** → **By site** → `t0n03k1.com` → **Auto ads** を Off

##### 4-4. 再デプロイして確認する

1. Actions → Deploy → **Run workflow**
2. PC・スマホで広告を確認
   - ヘッダー下・ページ内・記事内・サイドバー
   - 1ページ3枠以内
   - 入力・ダウンロード・保存ボタンの近くに出ていない
3. AdSense の **Policy center** を確認
4. 支払い・税情報を設定（報酬受け取りに必要）
5. 収益レポートを確認

> 承認前でも広告ユニットの作成と slot ID の登録はできます。先に準備しておくと、承認後すぐに配信できます。

#### 5. Search Console のインデックスを確認する

1. GSC → **URL inspection** で次を検査し、**Request indexing**
   - `https://t0n03k1.com/`
   - `https://t0n03k1.com/image-adjust/`
   - `https://t0n03k1.com/markdown-pdf/`
   - `https://t0n03k1.com/qr-code/`
2. **Pages** レポートで登録状況を確認
3. **Sitemaps** が「Success」になっているか確認（`https://t0n03k1.com/sitemap.xml`）
4. 数週間後に **Core Web Vitals** を確認

### 広告（AdSense）

有効にするには、AdSense のパブリッシャー ID と広告ユニット ID を GitHub の Variables に登録し、再デプロイします。`VITE_*` はビルド時に埋め込まれるため、登録だけでは反映されません。

#### 1. パブリッシャー ID を取得する

AdSense のサイト確認画面に出る次のどれかから `ca-pub-...` を控えます（どれも同じ ID です）。

- AdSense コードスニペット: `...?client=ca-pub-1234567890123456`
- ads.txt スニペット: `google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0` → `pub-...` の前に `ca-` を付ける
- メタタグ: `content="ca-pub-1234567890123456"`

スニペット自体をサイトに貼る必要はありません。このサイトは `VITE_ADSENSE_CLIENT` から AdSense のスクリプトと `/ads.txt` を自動で用意します。

#### 2. GitHub の Variables に登録する

https://github.com/katoline/useful-site/settings/variables/actions

| 名前 | 値 |
| --- | --- |
| `VITE_ADSENSE_CLIENT` | `ca-pub-...` |

#### 3. デプロイして ads.txt を確認する

Actions → Deploy → Run workflow で再デプロイし、次を開きます。

`https://t0n03k1.com/ads.txt`

次の行が出ていればOKです。

```text
google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
```

#### 4. AdSense でサイトを確認する

AdSense の確認画面で **ads.txt スニペット**を選び、確認します。コードスニペット方式は、このサイトが AdSense のスクリプトをハイドレーション後に読み込むため、確認クローラーが認識できない可能性があります。メタタグ方式はコード変更が必要です。

#### 5. 広告ユニットを作る

AdSense → **Ads / 広告** → **By ad unit / 広告ユニット別** → **Create ad unit / 広告ユニットを作成** で、次の4つを作ります。

| サイトの形式 | AdSense の種類 | 環境変数 |
| --- | --- | --- |
| ヘッダー下のバナー | Display ads（レスポンシブ） | `VITE_ADSENSE_SLOT_BANNER` |
| ページ内の横長枠 | Display ads（レスポンシブ） | `VITE_ADSENSE_SLOT_RESPONSIVE` |
| 記事内 | In-article ads | `VITE_ADSENSE_SLOT_IN_ARTICLE` |
| サイドバー | Display ads（縦長・レスポンシブ） | `VITE_ADSENSE_SLOT_SIDEBAR` |

各ユニットのコードに出る `data-ad-slot="1234567890"` の**数字10桁**を、同じ名前の Variables に登録します。

#### 6. 再デプロイして確認する

登録後に再度 Deploy を実行します。`VITE_ADSENSE_CLIENT` と対象の slot ID が揃った形式だけ広告が表示されます。未設定の形式は本番では何も出ません（開発時は破線のプレースホルダー）。

> サイトが AdSense に承認されるまで広告は配信されません。`ads.txt` と広告ユニットの設定は先に済ませておけます。CSP は AdSense 用のドメインを許可済みなので、コード変更は不要です。
