{
  description = "画像調整サイト（Vite + React Router v7 + Hono on Cloudflare Workers）";

  # Playwrightは固定した旧入力を使い、それ以外の開発ツールは修正版入力へ統一する。
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  # Playwright 等の固定は保ち、Node.js と共有ライブラリの修正だけを取り込む。
  inputs.nodejs-nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable-small";

  outputs =
    { nixpkgs, nodejs-nixpkgs, ... }:
    let
      system = "x86_64-linux";
      nodejsPkgs = import nodejs-nixpkgs { inherit system; };
      secureNode =
        assert nodejsPkgs.lib.versionAtLeast nodejsPkgs.nodejs_22.version "22.23.4";
        nodejsPkgs.nodejs_22;
      playwrightPkgs = import nixpkgs { inherit system; };
      pkgs = import nodejs-nixpkgs {
        inherit system;
        overlays = [
          (_: prev: {
            nodejs_22 = secureNode;
            pnpm = prev.pnpm.override { nodejs-slim = secureNode; };
          })
        ];
      };
    in
    assert pkgs.lib.versionAtLeast pkgs.openssl.version "3.5.9";
    assert pkgs.lib.versionAtLeast pkgs.cacert.version "3.131.1";
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_22
          pnpm
          playwrightPkgs.playwright-driver.browsers
        ];

        # Playwright のブラウザは Nix から供給する（npm 側でダウンロードさせない）
        PLAYWRIGHT_BROWSERS_PATH = "${playwrightPkgs.playwright-driver.browsers}";
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
        PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
        # @playwright/test はこの版に合わせる
        PLAYWRIGHT_DRIVER_VERSION = playwrightPkgs.playwright-driver.version;
      };
    };
}
