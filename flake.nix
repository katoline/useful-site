{
  description = "画像調整サイト（Vite + React Router v7 + Hono on Cloudflare Workers）";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
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
