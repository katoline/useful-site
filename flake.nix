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
      # Node本体の更新だけでは共有c-ares/SQLiteが古いままになるため、修正版を固定する。
      secureCares =
        if nodejsPkgs.lib.versionAtLeast nodejsPkgs.c-ares.version "1.34.9" then
          nodejsPkgs.c-ares
        else
          nodejsPkgs.c-ares.overrideAttrs (_: {
            version = "1.34.9";
            src = nodejsPkgs.fetchurl {
              url = "https://github.com/c-ares/c-ares/releases/download/v1.34.9/c-ares-1.34.9.tar.gz";
              hash = "sha256-k2S3ChLrWaBoMPtIjZNX+QEA3/DZiyPqNZOhg9Q+by8=";
            };
          });
      secureSqlite =
        if nodejsPkgs.lib.versionAtLeast nodejsPkgs.sqlite.version "3.53.4" then
          nodejsPkgs.sqlite
        else
          nodejsPkgs.sqlite.overrideAttrs (_: {
            version = "3.53.4";
            src = nodejsPkgs.fetchurl {
              url = "https://sqlite.org/2026/sqlite-src-3530400.zip";
              hash = "sha256-0Y+hWux02MF+FGP4YQla3AG1rRkCVqy0+R0i8DaNIys=";
            };
            docsrc = nodejsPkgs.fetchurl {
              url = "https://sqlite.org/2026/sqlite-doc-3530400.zip";
              hash = "sha256-odD13ldIXQYnlu1+Z9r/B1i1DQAAGg8jOiwVqvQLvcg=";
            };
          });
      # Nodeだけの依存を差し替える。PythonやPlaywright等の固定は変えない。
      secureSlim = nodejsPkgs.nodejs-slim_22.override {
        callPackage = path: args: nodejsPkgs.callPackage path (args // {
          c-ares = secureCares;
          sqlite = secureSqlite;
        });
      };
      secureNode =
        assert nodejsPkgs.lib.versionAtLeast secureSlim.version "22.23.4";
        nodejsPkgs.nodejs_22.override { nodejs-slim = secureSlim; };
      pkgs = import nixpkgs {
        inherit system;
        overlays = [
          (_: prev: {
            nodejs_22 = secureNode;
            pnpm = prev.pnpm.override { nodejs-slim = secureNode; };
          })
        ];
      };
    in
    {
      packages.${system}.nodejs-security = secureNode;
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
