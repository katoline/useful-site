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

## GIF（Gifsicle 1.98）

`gifsicle-wasm-browser-1.5.19-security.1.tgz`は上流npm版1.5.19に含まれるGifsicle 1.92のWASMとglueを、公式1.98で再ビルドしたものへ交換したローカル配布物です。既存の`run` APIを維持し、上流のメモリ安全性修正を取り込みます。

- Gifsicle: `8ff3057b736141b406be621830b851fdf4285689`（v1.98）
- 公式ソースSHA-256: `8620d29336b555a4c122d8c736c41900706d61e77ecade2d9051d114a92d0626`
- Emscripten: 3.1.45（SDKソースのコミット・SHA-256もワークフローで固定）
- パッケージSHA-256: `17896fd8868ae2c1a9d68e79e1e851e6413d70ac4b46723bb0c3a7a67d080c8c`

再生成はGitHub Actionsの`Rebuild GIF codec`を手動実行します。`.github/workflows/rebuild-gif-codec.yml`が公式ソースを検証してビルドし、`scripts/package-gif-security.py`が元のnpm配布物のSHA-512を検証して再梱包します。時刻・所有者・ファイルモード・gzip圧縮レベルを固定し、CI成果物とクラウドでの再梱包が同じSHA-256になることを確認しています。対応する公式ソース一式とGifsicleのライセンスはパッケージ内にも同梱しています。

`gif-security.test.ts`は配布するWorker/WASMで実際に`--version`を実行し、表示上のnpmバージョンだけでは判断しません。アニメーションのフレーム保持、リサイズ、減色も検証します。1.96以降では上流の非可逆圧縮アルゴリズムが変わっているため、同じlossy値でも旧版と出力サイズが異なる場合があります。

このローカルtarballはDependabotでは更新されません。Gifsicleとラッパーの公式更新・アドバイザリを確認し、修正版を含む上流npm版が出たら通常依存へ戻すか、固定ソースを更新して再ビルドしてください。参考: https://github.com/kohler/gifsicle/blob/v1.98/NEWS.md
