/**
 * アプリのビルド後フック（app/apps/<id>/build/postbuild.ts）の型。
 * scripts/postbuild.ts がフックを自動で集めて呼ぶ。フックは Node の型除去で直接実行されるので、
 * import は拡張子付きの相対パスで書く（`~` エイリアスは使えない）。
 */
import type { HeaderRule } from "./csp.ts";

export interface AppBuildContext {
  /** プロジェクトのルート */
  root: string;
  /** 静的アセットのルート（build/client） */
  clientDir: string;
  /** このアプリの配信ディレクトリ（build/client/<path>） */
  appDir: string;
  /** このアプリの URL の接頭辞（"/<path>"。末尾スラッシュなし。ポータルは ""） */
  basePath: string;
}

export interface AppBuildResult {
  /** _headers に足すルール */
  headers?: HeaderRule[];
}

export type AppPostbuild = (context: AppBuildContext) => Promise<AppBuildResult>;
