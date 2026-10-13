/**
 * E2E 用の小さな PDF 読み取り（依存を増やさないため自前）。Chromium（Skia）が出す PDF を前提に、
 * ページ数・用紙の大きさ・本文の文字（ToUnicode の CMap で glyph → 文字に戻す）を取り出す。
 */
import { constants, inflateSync } from "node:zlib";

interface PdfObject {
  dict: string;
  stream?: Buffer;
}

function parseObjects(pdf: Buffer): Map<number, PdfObject> {
  const source = pdf.toString("latin1");
  const objects = new Map<number, PdfObject>();
  for (const match of source.matchAll(/(\d+) 0 obj\b([\s\S]*?)\bendobj/g)) {
    const body = match[2] ?? "";
    const streamAt = body.search(/\bstream\r?\n/);
    if (streamAt < 0) {
      objects.set(Number(match[1]), { dict: body });
      continue;
    }
    const dict = body.slice(0, streamAt);
    const start = streamAt + (body.slice(streamAt).match(/^stream\r?\n/)?.[0].length ?? 7);
    const end = body.lastIndexOf("endstream");
    let raw = Buffer.from(body.slice(start, end).replace(/\r?\n$/, ""), "latin1");
    if (/\/FlateDecode/.test(dict)) {
      raw = inflateSync(raw, { finishFlush: constants.Z_SYNC_FLUSH });
    }
    objects.set(Number(match[1]), { dict, stream: raw });
  }
  return objects;
}

function refs(text: string): number[] {
  return [...text.matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));
}

function utf16be(hex: string): string {
  let out = "";
  for (let i = 0; i + 4 <= hex.length; i += 4)
    out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

/** ToUnicode の CMap（bfchar / bfrange）を「glyph の 16 進 → 文字」にする */
function parseCMap(cmap: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of (block[1] ?? "").matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g))
      map.set((m[1] ?? "").toUpperCase(), utf16be(m[2] ?? ""));
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of (block[1] ?? "").matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])/g,
    )) {
      const from = parseInt(m[1] ?? "0", 16);
      const to = parseInt(m[2] ?? "0", 16);
      const width = (m[1] ?? "").length;
      const list = m[5] ? [...m[5].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => x[1] ?? "") : null;
      for (let code = from; code <= to; code++) {
        const key = code.toString(16).toUpperCase().padStart(width, "0");
        if (list) map.set(key, utf16be(list[code - from] ?? ""));
        else {
          const base = parseInt(m[4] ?? "0", 16) + (code - from);
          map.set(key, utf16be(base.toString(16).padStart(4, "0")));
        }
      }
    }
  }
  return map;
}

function resourcesOf(objects: Map<number, PdfObject>, page: PdfObject): string {
  const inline = /\/Resources\s*(<<[\s\S]*>>)/.exec(page.dict)?.[1];
  if (inline) return inline;
  const ref = /\/Resources\s+(\d+) 0 R/.exec(page.dict)?.[1];
  return ref ? (objects.get(Number(ref))?.dict ?? "") : "";
}

export interface PdfSummary {
  pageCount: number;
  /** 各ページの MediaBox の幅・高さ（pt） */
  pageSizes: { width: number; height: number }[];
  /** 各ページの本文（NFKC で正規化し、空白・改行を除いた文字の並び） */
  pageTexts: string[];
}

export function readPdf(pdf: Buffer): PdfSummary {
  const objects = parseObjects(pdf);
  const pages = [...objects.values()].filter((obj) => /\/Type\s*\/Page(?![s\w])/.test(obj.dict));
  const pageSizes = pages.map((page) => {
    const box = /\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/.exec(
      page.dict,
    );
    return {
      width: Number(box?.[3] ?? 0) - Number(box?.[1] ?? 0),
      height: Number(box?.[4] ?? 0) - Number(box?.[2] ?? 0),
    };
  });
  const pageTexts = pages.map((page) => {
    const fonts = new Map<string, Map<string, string>>();
    const fontDict = /\/Font\s*<<([\s\S]*?)>>/.exec(resourcesOf(objects, page))?.[1] ?? "";
    for (const m of fontDict.matchAll(/\/([\w.+-]+)\s+(\d+) 0 R/g)) {
      const font = objects.get(Number(m[2]));
      const toUnicode = /\/ToUnicode\s+(\d+) 0 R/.exec(font?.dict ?? "")?.[1];
      const cmap = toUnicode
        ? objects.get(Number(toUnicode))?.stream?.toString("latin1")
        : undefined;
      fonts.set(m[1] ?? "", cmap ? parseCMap(cmap) : new Map());
    }
    const contentsRef = /\/Contents\s*(\[[^\]]*\]|\d+ 0 R)/.exec(page.dict)?.[1] ?? "";
    const content = refs(contentsRef)
      .map((ref) => objects.get(ref)?.stream?.toString("latin1") ?? "")
      .join("\n");
    let current = new Map<string, string>();
    let text = "";
    for (const token of content.matchAll(
      /\/([\w.+-]+)\s+[\d.]+\s+Tf|<([0-9a-fA-F\s]*)>|\(((?:\\.|[^\\)])*)\)/g,
    )) {
      if (token[1]) {
        current = fonts.get(token[1]) ?? new Map();
      } else if (token[2] !== undefined) {
        const hex = token[2].replace(/\s+/g, "").toUpperCase();
        const width = [...current.keys()][0]?.length ?? 4;
        for (let i = 0; i + width <= hex.length; i += width)
          text += current.get(hex.slice(i, i + width)) ?? "";
      } else if (token[3] !== undefined) {
        text += token[3];
      }
    }
    // フォントの CMap が康熙部首（⽂ 等）を返すことがあるので NFKC でそろえる
    return text.normalize("NFKC").replace(/\s+/g, "");
  });
  return { pageCount: pages.length, pageSizes, pageTexts };
}
