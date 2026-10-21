# 残タスクと公開後の手順

最終更新: 2026-10-21

> `docs/` は gitignore 済みのローカル用メモです。リポジトリにはコミットされません。
> 別のクローンや別マシンでは見えないので、共有したい内容は README などに置いてください。

## 現在の状態

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

## 1. www（`www.t0n03k1.com`）を設定する（任意）

現状は apex のみで、`www` の DNS レコードも Redirect Rule もない。使わない場合はこの手順を飛ばしてよい。

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

`www` が 301 で apex に転送され、apex が 200 ならOK。

## 2. 監視・アラートを設定する（任意）

### Cloudflare Alerts

1. `https://dash.cloudflare.com/?to=/:account/notifications` を開く
2. **Add** を押す
3. Workers 関連のアラート（Worker のエラー・失敗など）を選ぶ
4. 通知先（メールなど）を設定する

### 外部の uptime 監視

UptimeRobot・Better Stack などで次を5分間隔で監視する。

- `https://t0n03k1.com/`（HTTP 200）
- `https://t0n03k1.com/image-adjust/api/health`（HTTP 200、本文に `"ok":true`）

### Search Console の通知

GSC → **Settings** → **Email notifications** を On にする。

## 3. Cloudflare Web Analytics を設定する（任意）

1. `https://dash.cloudflare.com/?to=/:account/web-analytics` を開く
2. **Add a site**
3. ドロップダウンから `t0n03k1.com` を選ぶ → **Done**

プロキシ済みのサイトは**自動設定が既定で有効**。数分後にデータが出る。

自動設定でデータが出ない場合は、GitHub の Variables に `VITE_CF_ANALYTICS_TOKEN` を追加して再デプロイする。このサイトはトークンが設定されたときだけビーコンを入れる。

## 4. AdSense を有効にする（審査中）

### 4-1. 広告ユニットを作る

AdSense → **Ads** → **By ad unit** → **Create ad unit** で4つ作る。

| サイトの形式 | AdSense の種類 | GitHub Variable |
| --- | --- | --- |
| ヘッダー下のバナー | Display ads（レスポンシブ） | `VITE_ADSENSE_SLOT_BANNER` |
| ページ内の横長枠 | Display ads（レスポンシブ） | `VITE_ADSENSE_SLOT_RESPONSIVE` |
| 記事内 | In-article ads | `VITE_ADSENSE_SLOT_IN_ARTICLE` |
| サイドバー | Display ads（縦長・レスポンシブ） | `VITE_ADSENSE_SLOT_SIDEBAR` |

各ユニットの `data-ad-slot="1234567890"` の**数字10桁**を、対応する Variables に登録する。

https://github.com/katoline/useful-site/settings/variables/actions

### 4-2. CMP を設定する

EEA・英国・スイス向けの同意管理が必要。

1. AdSense → **Privacy & messaging**
2. **European regulations** → **CMP**
3. CMP を作成し、対象地域（EEA・英国・スイス）と言語（日本語・英語）を設定
4. メッセージを公開

### 4-3. Auto ads を Off にする

このサイトは `AdSlot` で手動配置しているため、Auto ads は Off にする。

- AdSense → **Ads** → **By site** → `t0n03k1.com` → **Auto ads** を Off

### 4-4. 再デプロイして確認する

1. Actions → Deploy → **Run workflow**
2. PC・スマホで広告を確認
   - ヘッダー下・ページ内・記事内・サイドバー
   - 1ページ3枠以内
   - 入力・ダウンロード・保存ボタンの近くに出ていない
3. AdSense の **Policy center** を確認
4. 支払い・税情報を設定（報酬受け取りに必要）
5. 収益レポートを確認

> 承認前でも広告ユニットの作成と slot ID の登録はできる。先に準備しておくと、承認後すぐに配信できる。

## 5. Search Console のインデックスを確認する

1. GSC → **URL inspection** で次を検査し、**Request indexing**
   - `https://t0n03k1.com/`
   - `https://t0n03k1.com/image-adjust/`
   - `https://t0n03k1.com/markdown-pdf/`
   - `https://t0n03k1.com/qr-code/`
2. **Pages** レポートで登録状況を確認
3. **Sitemaps** が「Success」になっているか確認（`https://t0n03k1.com/sitemap.xml`）
4. 数週間後に **Core Web Vitals** を確認

## 付録: AdSense の初期設定

初回の設定は完了済み。再設定が必要になったときの手順。

### パブリッシャー ID

AdSense のサイト確認画面のスニペットから `ca-pub-...` を控える。どれも同じ ID。

- AdSense コードスニペット: `...?client=ca-pub-1234567890123456`
- ads.txt スニペット: `google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0` → `pub-...` の前に `ca-` を付ける
- メタタグ: `content="ca-pub-1234567890123456"`

スニペット自体はサイトに貼らない。サイトは `VITE_ADSENSE_CLIENT` からスクリプトと `/ads.txt` を作る。

### GitHub Variables

https://github.com/katoline/useful-site/settings/variables/actions

| 名前 | 値 |
| --- | --- |
| `VITE_ADSENSE_CLIENT` | `ca-pub-...` |
| `VITE_ADSENSE_SLOT_BANNER` | 数字10桁 |
| `VITE_ADSENSE_SLOT_RESPONSIVE` | 数字10桁 |
| `VITE_ADSENSE_SLOT_IN_ARTICLE` | 数字10桁 |
| `VITE_ADSENSE_SLOT_SIDEBAR` | 数字10桁 |

Secret ではなく Variable に入れる。

### ads.txt の確認

デプロイ後に `https://t0n03k1.com/ads.txt` を開き、次の行が出ているか確認する。

```text
google.com, pub-1642376634502890, DIRECT, f08c47fec0942fa0
```

### AdSense のサイト認証

AdSense の確認画面で **ads.txt スニペット**を選んで確認する。コードスニペット方式は、このサイトが AdSense のスクリプトをハイドレーション後に読み込むため、確認クローラーが認識できない可能性がある。メタタグ方式はコード変更が必要。
