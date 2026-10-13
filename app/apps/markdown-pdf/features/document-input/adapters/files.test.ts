// @vitest-environment happy-dom
import { Buffer } from "node:buffer";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useObjectUrls } from "./files";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("取り込んだ画像の URL", () => {
  it("拡張子または MIME が SVG の画像は固定 MIME の base64 data: URL にする", async () => {
    const createUrl = vi.spyOn(URL, "createObjectURL");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>日本語</text></svg>';
    const files = [
      new File([svg], "Logo.SVG", { type: "text/html" }),
      new File([svg], "image.bin", { type: "image/svg+xml" }),
    ];
    const { result } = renderHook(() => useObjectUrls(files));

    await waitFor(() => expect(result.current.size).toBe(2));
    for (const file of files) {
      expect(result.current.get(file.name)).toBe(
        `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      );
    }
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("SVG 以外は blob: URL にし、一覧変更とアンマウントで解放する", () => {
    vi.spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const first = new File(["png"], "first.png", { type: "image/png" });
    const second = new File(["jpeg"], "second.jpg", { type: "image/jpeg" });
    const { result, rerender, unmount } = renderHook(({ files }) => useObjectUrls(files), {
      initialProps: { files: [first] },
    });
    expect(result.current.get(first.name)).toBe("blob:first");
    rerender({ files: [second] });
    expect(result.current.get(second.name)).toBe("blob:second");
    expect(revokeUrl).toHaveBeenCalledWith("blob:first");
    unmount();
    expect(revokeUrl).toHaveBeenCalledWith("blob:second");
  });

  it.each([
    ["png", "image/png"],
    ["jpg", "image/jpeg"],
    ["jpeg", "image/jpeg"],
    ["gif", "image/gif"],
    ["webp", "image/webp"],
    ["avif", "image/avif"],
  ])(".%s は空 MIME・HTML MIME の入力でも %s の Blob に作り直す", (extension, mime) => {
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const files = [
      new File(["<html>"], `first.${extension}`),
      new File(["<html>"], `second.${extension.toUpperCase()}`, { type: "text/html" }),
    ];
    const { result } = renderHook(() => useObjectUrls(files));

    expect(result.current.size).toBe(2);
    expect(createUrl).toHaveBeenCalledTimes(2);
    for (const [blob] of createUrl.mock.calls) {
      expect(blob).toBeInstanceOf(Blob);
      expect(blob).not.toBeInstanceOf(File);
      expect(blob).toMatchObject({ type: mime, size: files[0]?.size });
    }
  });

  it("対応表にない拡張子は画像 MIME でも URL を作らない", () => {
    const createUrl = vi.spyOn(URL, "createObjectURL");
    const files = [
      new File(["<html>"], "image.html", { type: "image/png" }),
      new File(["<html>"], "image", { type: "image/jpeg" }),
    ];
    const { result } = renderHook(() => useObjectUrls(files));

    expect(result.current.size).toBe(0);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("一覧変更後やアンマウント後に完了した古い SVG の読み込みを反映しない", async () => {
    const readers: FileReader[] = [];
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) {
      readers.push(this);
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:current");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const first = new File(["svg"], "first.svg");
    const second = new File(["png"], "second.png");
    const { result, rerender, unmount } = renderHook(({ files }) => useObjectUrls(files), {
      initialProps: { files: [first] },
    });
    rerender({ files: [second] });
    await act(async () => {
      Object.defineProperty(readers[0], "result", { value: "data:image/svg+xml;base64,AAAA" });
      readers[0]?.dispatchEvent(new ProgressEvent("load"));
    });
    expect([...result.current]).toEqual([["second.png", "blob:current"]]);

    rerender({ files: [first] });
    unmount();
    await act(async () => {
      Object.defineProperty(readers[1], "result", { value: "data:image/svg+xml;base64,AAAA" });
      readers[1]?.dispatchEvent(new ProgressEvent("load"));
    });
    expect(result.current.size).toBe(0);
  });
});
