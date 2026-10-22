{
  description = "画像調整サイト（Vite + React Router v7 + Hono on Cloudflare Workers）";

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
      pkgs = import nixpkgs {
        inherit system;
        overlays = [
          (_: prev: {
            # Git等が使うTLSライブラリとCA証明書も修正版へそろえる。
            openssl = nodejsPkgs.openssl;
            cacert = nodejsPkgs.cacert;
            nodejs_22 = secureNode;
            pnpm = prev.pnpm.override { nodejs-slim = secureNode; };
          })
        ];
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_22
          pnpm
          playwright-driver.browsers
        ];

        # Playwright のブラウザは Nix から供給する（npm 側でダウンロードさせない）
        PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
        PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
        # @playwright/test はこの版に合わせる
        PLAYWRIGHT_DRIVER_VERSION = pkgs.playwright-driver.version;
      };
    };
}
