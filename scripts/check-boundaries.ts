/** import の解決先と規約による収集を検査する。Biome では glob 呼び出しを検査できない。 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export interface BoundaryIssue {
  file: string;
  line: number;
  message: string;
}

/** 収集元とパターンの組を許可する。個別アプリの例外は作らない。 */
export const COLLECTION_GLOBS: Record<string, readonly string[]> = {
  "app/platform/registry/index.ts": ["app/apps/*/manifest.ts"],
  "app/platform/legal/index.tsx": ["app/apps/*/legal/{privacy,terms}.{ja,en}.mdx"],
  "worker/index.ts": ["app/apps/*/api/index.ts"],
};

function appPart(file: string) {
  const match = /^app\/apps\/([^/]+)\/(.*)$/.exec(file);
  return match ? { id: match[1], rest: match[2] ?? "" } : undefined;
}

function featurePart(rest: string) {
  // features/<id> だけ（ディレクトリの import ＝ index）も feature への依存として扱う
  const match = /^features\/([^/]+)(?:\/(.*))?$/.exec(rest);
  return match ? { id: match[1], rest: match[2] ?? "" } : undefined;
}

function modulePath(file: string, specifier: string, root: string): string | undefined {
  const spec = specifier.replace(/[?#].*$/, "");
  const absolute = spec.startsWith("~/")
    ? path.resolve(root, "app", spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(root, path.dirname(file), spec)
      : spec.startsWith("/app/")
        ? path.resolve(root, spec.slice(1))
        : undefined;
  return absolute ? path.relative(root, absolute).split(path.sep).join("/") : undefined;
}

const domLib = ts.createSourceFile(
  "lib.dom.d.ts",
  readFileSync(path.join(path.dirname(ts.getDefaultLibFilePath({})), "lib.dom.d.ts"), "utf8"),
  ts.ScriptTarget.Latest,
);
/** DOM に依存しない、Node・Worker でも使える標準 API。 */
const STANDARD_APIS = new Set([
  "TextDecoder",
  "TextEncoder",
  "URL",
  "URLSearchParams",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "queueMicrotask",
  "structuredClone",
  "atob",
  "btoa",
  "console",
  "AbortController",
  "AbortSignal",
  "Blob",
  "crypto",
]);
const domTypes = new Set<string>();
/** DOM の値（window・document・sessionStorage・print 等、lib.dom.d.ts の declare var / function） */
const domGlobals = new Set<string>();
for (const node of domLib.statements) {
  if (
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node)
  ) {
    if (node.name && !STANDARD_APIS.has(node.name.text)) domTypes.add(node.name.text);
  } else if (ts.isVariableStatement(node)) {
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && !STANDARD_APIS.has(declaration.name.text))
        domGlobals.add(declaration.name.text);
    }
  } else if (ts.isFunctionDeclaration(node) && node.name) {
    if (!STANDARD_APIS.has(node.name.text)) domGlobals.add(node.name.text);
  }
}

/** 識別子が値の参照か（プロパティ名・宣言の名前・型の位置ではない） */
function isValueReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isQualifiedName(parent) || ts.isTypeReferenceNode(parent)) return false;
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isEnumMember(parent) ||
      ts.isBindingElement(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isImportSpecifier(parent) ||
      ts.isExportSpecifier(parent)) &&
    parent.name === node
  )
    return false;
  if (ts.isLabeledStatement(parent) && parent.label === node) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return false;
  return true;
}

/** `import type` / `export type` / `import("...")` 型の位置など、実行時に残らない import か */
function isTypeOnly(node: ts.Node): boolean {
  if (ts.isImportTypeNode(node)) return true;
  if (ts.isImportDeclaration(node)) return node.importClause?.isTypeOnly ?? false;
  if (ts.isExportDeclaration(node)) return node.isTypeOnly;
  return false;
}

export function analyzeBoundaries(
  fileName: string,
  source: string,
  root = process.cwd(),
): BoundaryIssue[] {
  const file = path.relative(root, path.resolve(root, fileName)).split(path.sep).join("/");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const issues: BoundaryIssue[] = [];
  const owner = appPart(file);
  const feature = owner ? featurePart(owner.rest) : undefined;
  const core = feature?.rest.startsWith("core/") ?? false;
  const inShared = owner?.rest.startsWith("shared/") ?? false;
  const inDomain = owner?.rest.startsWith("domain/") ?? false;
  const pure = core || inDomain;
  const declaredNames = new Set<string>();
  function collectNames(node: ts.Node) {
    if (
      ts.isImportSpecifier(node) ||
      ts.isImportClause(node) ||
      ts.isNamespaceImport(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeParameterDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isBindingElement(node) ||
      ts.isEnumDeclaration(node)
    ) {
      if (node.name && ts.isIdentifier(node.name)) declaredNames.add(node.name.text);
    }
    ts.forEachChild(node, collectNames);
  }
  collectNames(ast);
  function report(node: ts.Node, message: string) {
    issues.push({
      file,
      line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      message,
    });
  }
  function checkImport(node: ts.Node, spec: string, glob = false, typeOnly = false) {
    const target = modulePath(file, spec, root);
    const dependency = target ? appPart(target) : undefined;
    if (glob && dependency && !owner) {
      if (!COLLECTION_GLOBS[file]?.includes(target ?? "")) {
        report(node, `許可されていないアプリ収集: ${spec}`);
      }
      return;
    }
    if (owner && dependency && owner.id !== dependency.id) {
      report(node, `他のアプリへの依存: ${spec}`);
      return;
    }
    if (file.startsWith("app/platform/") && dependency) {
      report(node, `土台からアプリへの依存: ${spec}`);
      return;
    }
    if (
      dependency &&
      (file.startsWith("scripts/") ||
        file.startsWith("worker/") ||
        ["app/root.tsx", "app/routes.ts", "vite.config.ts", "react-router.config.ts"].includes(
          file,
        ))
    ) {
      report(node, `共通の入口から特定アプリへの依存: ${spec}`);
      return;
    }
    if (!owner) return;
    const targetFeature = dependency ? featurePart(dependency.rest) : undefined;
    if (targetFeature && feature?.id !== targetFeature.id) {
      if (feature) report(node, `別の feature への依存: ${spec}`);
      else if (!/^(?:index(?:\.[cm]?[jt]sx?)?)?$/.test(targetFeature.rest)) {
        report(node, `feature の外から内部ファイルへの依存: ${spec}`);
      }
    }
    const page = /^pages\/([^/]+)\//.exec(owner.rest)?.[1];
    const targetPage = dependency ? /^pages\/([^/]+)\//.exec(dependency.rest)?.[1] : undefined;
    if (page && targetPage && page !== targetPage) report(node, `別のページへの依存: ${spec}`);
    if (
      inShared &&
      dependency &&
      dependency.id === owner.id &&
      /^(?:features|pages)\//.test(dependency.rest)
    ) {
      report(node, `shared は features・pages に依存できません: ${spec}`);
    }
    if (inDomain) {
      const sameDomain =
        !!dependency && dependency.id === owner.id && dependency.rest.startsWith("domain/");
      if (!sameDomain && !typeOnly)
        report(node, `domain は自分の domain と型だけの import 以外に依存できません: ${spec}`);
    }
    if (core) {
      const sameCore =
        dependency?.id === owner.id &&
        targetFeature?.id === feature?.id &&
        targetFeature?.rest.startsWith("core/");
      const domain = dependency?.id === owner.id && dependency?.rest.startsWith("domain/");
      if (!sameCore && !domain)
        report(node, `core は自分の core と domain だけに依存できます: ${spec}`);
    }
  }
  function checkLiteral(node: ts.Node, value: ts.Node | undefined, glob = false) {
    if (value && ts.isStringLiteralLike(value)) {
      checkImport(node, value.text, glob, isTypeOnly(node));
    } else if (value && ts.isArrayLiteralExpression(value)) {
      for (const element of value.elements) checkLiteral(node, element, glob);
    } else if (glob) report(node, "glob の収集パターンは文字列リテラルで指定してください");
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      checkLiteral(node, node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      checkLiteral(node, node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      checkLiteral(node, node.argument.literal);
    } else if (ts.isCallExpression(node)) {
      const call = node.expression;
      if (
        call.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(call) && call.text === "require")
      ) {
        checkLiteral(node, node.arguments[0]);
      } else if (
        ts.isPropertyAccessExpression(call) &&
        ["glob", "globEager"].includes(call.name.text) &&
        ts.isMetaProperty(call.expression) &&
        call.expression.keywordToken === ts.SyntaxKind.ImportKeyword
      )
        checkLiteral(node, node.arguments[0], true);
    }
    if (
      pure &&
      ts.isIdentifier(node) &&
      domGlobals.has(node.text) &&
      !declaredNames.has(node.text) &&
      isValueReference(node)
    ) {
      report(node, `${core ? "core" : "domain"} で DOM のグローバルを使えません: ${node.text}`);
    }
    if (pure && ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      const name = node.typeName.text;
      if (domTypes.has(name) && !declaredNames.has(name))
        report(node, `${core ? "core" : "domain"} で DOM の型を使えません: ${name}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return issues;
}

export function checkBoundaries(root = process.cwd()): BoundaryIssue[] {
  const files: string[] = [];
  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:[cm]?[jt]sx?|mdx)$/.test(entry.name)) files.push(file);
    }
  }
  for (const directory of ["app", "scripts", "worker"]) walk(path.join(root, directory));
  for (const file of ["vite.config.ts", "react-router.config.ts"])
    files.push(path.join(root, file));
  return files.flatMap((file) => analyzeBoundaries(file, readFileSync(file, "utf8"), root));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const issues = checkBoundaries();
  for (const issue of issues) console.error(`${issue.file}:${issue.line}: ${issue.message}`);
  if (issues.length) process.exitCode = 1;
  else console.log("依存の境界: 違反なし");
}
