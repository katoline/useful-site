# WebPのローカルセキュリティビルド

`jsquash-webp-1.5.0-security.1.tgz` は、このリポジトリ用に再ビルドした
`@jsquash/webp` です。上流npmで公開された版ではありません。

上流1.5.0の同梱libwebpは、実行時の版が1.1.0で、修正前の公式バイナリと一致しました。
libwebpの[公式NEWS](https://github.com/webmproject/libwebp/blob/v1.3.2/NEWS)にある
CVE-2023-4863（デコード）・CVE-2023-1999（可逆エンコード）等の修正を含む
公式1.6.0へ、両方のコーデックを差し替えています。
問題のある画像を処理する場所はブラウザのWorker/WASMです。
サーバーのOS権限を取得できることを示したものではありません。

再生成は `.github/workflows/rebuild-webp-codec.yml` の手動実行で行います。
ソースの固定コミット・SHA-256と、上流npm tarballのSHA-512を検証し、
Emscripten 3.1.45でビルドして `scripts/package-webp-security.py` で再パッケージします。
ワークフローの権限は読み取りのみで、リポジトリへ自動pushしません。
成果物をダウンロードして既存ファイルと置き換え、lockfileを更新し、全検証を通してからPRにします。

- libwebp 1.6.0: `4fa21912338357f89e4fd51cf2368325b59e9bd9`
- jSquash glue: `641dcc6b853382d57450466bd61b76f9d022242e`
- emsdk 3.1.45: `c8dcb45665fec5e743336703f1d22a191810f2a8`

可逆・非可逆のAPIは維持します。古いSIMDバイナリへの切り替えを防ぐため、
当面は全端末で再ビルドしたベースライン版を使い、SIMDによる高速化は使いません。
端末や画像によって処理が遅くなる可能性があります。

このローカルtarballはDependabotが自動更新する対象ではありません。
上流npmに修正版が提供されたら、同梱コーデックの実バージョンをテストしたうえで
レジストリ版へ戻します。新たなlibwebpの告知が出た場合も再ビルドが必要です。
`webp-security.test.ts` はエンコーダー・デコーダー両方の実バージョンを検査します。

現在のtarballのSHA-256: `6333a6eea2cff706f464b3ddd00c7b9382c90d8eac8816f157aa6952bcde7b90`。
