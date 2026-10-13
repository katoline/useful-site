/**
 * アプリを外しても土台・他のアプリが壊れないことを確かめる（docs/site-plan.md §3「守らせ方」）。
 *
 * ポータル（path が ""）以外の各アプリについて、「そのアプリのフォルダが無い状態」で
 * `pnpm typecheck` と `pnpm build` が通るかを見る。アプリが 2 つ以上あれば、全部を外した状態
 * （ポータルだけ）も確かめる。作業ツリーは壊さないよう、一時ディレクトリに複製して行う。
 *
 * 使い方：`nix develop -c pnpm check:apps`（引数でアプリの id を渡すとそれだけを確かめる）
 */
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadAppManifests } from "./lib/apps.ts";

const root = path.resolve(import.meta.dirname, "..");

/** 複製しないもの（ルート直下の名前）。生成物・依存・履歴・秘密情報 */
const SKIP_TOP = new Set([
  "node_modules",
  "build",
  ".git",
  "test-results",
  "playwright-report",
  ".wrangler",
  ".react-router",
  ".direnv",
]);
function shouldCopy(relative: string): boolean {
  const top = relative.split(path.sep)[0] ?? "";
  if (SKIP_TOP.has(top)) return false;
  // .env / .env.* は複製しない（雛形の .env.example だけは残す）
  if (relative === top && /^\.env/.test(top) && top !== ".env.example") return false;
  if (relative === top && top === ".dev.vars") return false;
  return true;
}

function run(cwd: string, args: string[]): boolean {
  console.log(`\n$ pnpm ${args.join(" ")}  （${cwd}）`);
  const result = spawnSync("pnpm", args, { cwd, stdio: "inherit", env: process.env });
  return result.status === 0;
}

/** removed のフォルダを外した複製で typecheck と build を流す */
async function check(removed: string[]): Promise<boolean> {
  const label = removed.join("・");
  const tmp = await mkdtemp(path.join(os.tmpdir(), "useful-site-apps-"));
  try {
    await cp(root, tmp, {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(root, source);
        return relative === "" || shouldCopy(relative);
      },
    });
    await symlink(path.join(root, "node_modules"), path.join(tmp, "node_modules"), "dir");
    for (const dir of removed) {
      await rm(path.join(tmp, "app/apps", dir), { recursive: true, force: true });
    }
    console.log(`\n=== ${label} を外して確かめる ===`);
    const ok = run(tmp, ["typecheck"]) && run(tmp, ["build"]);
    console.log(
      ok ? `=== ${label} を外しても通りました ===` : `=== ${label} を外すと失敗します ===`,
    );
    return ok;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

const apps = (await loadAppManifests(root)).map(({ dir, manifest }) => ({
  dir: path.basename(dir),
  path: manifest.path,
}));
const targets = apps.filter((app) => app.path !== "");
const only = process.argv.slice(2);
const unknown = only.filter((id) => !targets.some((app) => app.dir === id));
if (unknown.length > 0) {
  console.error(`外せるアプリではありません: ${unknown.join(", ")}`);
  process.exit(1);
}
const cases = (only.length > 0 ? targets.filter((app) => only.includes(app.dir)) : targets).map(
  (app) => [app.dir],
);
// アプリが 2 つ以上なら、全部を外した状態（ポータルだけ）も確かめる（1 つなら上と同じになる）
if (only.length === 0 && targets.length > 1) cases.push(targets.map((app) => app.dir));
if (cases.length === 0) {
  console.log("ポータル以外のアプリがありません（確かめるものはありません）");
  process.exit(0);
}

const failed: string[] = [];
for (const removed of cases) {
  if (!(await check(removed))) failed.push(removed.join("・"));
}
if (failed.length > 0) {
  console.error(`\ncheck:apps: 次を外すと typecheck / build が失敗します: ${failed.join(" / ")}`);
  process.exit(1);
}
console.log(`\ncheck:apps: ${cases.length} 通りすべて通りました`);
