// @vitest-environment happy-dom
/**
 * 非同期読み込みの進行と競合防止を検証する。
 * 画像のデコード（DOM・Canvas）は adapters のモックに置き換え、呼び出し順だけを操る。
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type IconSelection, imageIcon, noIcon } from "../../../domain/icons";
import { type DecodedIconImage, decodeIconImage, IconImageError } from "../adapters/image-loader";
import { useIconSelection } from "../ui/use-icon-selection";

vi.mock("../adapters/image-loader", () => {
  class IconImageAbortError extends Error {}
  class IconImageError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  return { decodeIconImage: vi.fn(), IconImageAbortError, IconImageError };
});

const decode = vi.mocked(decodeIconImage);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function pngFile(name = "a.png"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

const loaded: DecodedIconImage = {
  dataUrl: "data:image/png;base64,AAAA",
  width: 512,
  height: 256,
};

function setup(initial: IconSelection = noIcon()) {
  const onSelect = vi.fn();
  const view = renderHook(
    ({ selection }: { selection: IconSelection }) => useIconSelection({ selection, onSelect }),
    { initialProps: { selection: initial } },
  );
  return { ...view, onSelect };
}

beforeEach(() => {
  decode.mockReset();
});

describe("useIconSelection", () => {
  it("画像を読み込んでから親へ通知し、読み込み中は status を返す", async () => {
    const load = deferred<DecodedIconImage>();
    decode.mockReturnValueOnce(load.promise);
    const { result, onSelect } = setup();

    act(() => result.current.selectImage(pngFile()));
    expect(result.current.status).toBe("loading");
    expect(onSelect).not.toHaveBeenCalled();

    await act(async () => {
      load.resolve(loaded);
      await load.promise;
    });
    expect(result.current.status).toBe("idle");
    expect(onSelect).toHaveBeenCalledWith(imageIcon(loaded.dataUrl, 512, 256));
  });

  it("素早く別の画像へ置き換えたら、古い読み込み結果は捨てる", async () => {
    const first = deferred<DecodedIconImage>();
    const second = deferred<DecodedIconImage>();
    decode.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, onSelect } = setup();

    act(() => result.current.selectImage(pngFile("first.png")));
    act(() => result.current.selectImage(pngFile("second.png")));

    await act(async () => {
      first.resolve({ dataUrl: "data:image/png;base64,FIRST", width: 100, height: 100 });
      await first.promise;
    });
    expect(onSelect).not.toHaveBeenCalled();

    await act(async () => {
      second.resolve({ dataUrl: "data:image/png;base64,SECOND", width: 200, height: 200 });
      await second.promise;
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(imageIcon("data:image/png;base64,SECOND", 200, 200));
  });

  it("読み込み中に「なし」へ切り替えたら、あとから届く結果で上書きしない", async () => {
    const load = deferred<DecodedIconImage>();
    decode.mockReturnValueOnce(load.promise);
    const { result, onSelect } = setup();

    act(() => result.current.selectImage(pngFile()));
    expect(result.current.status).toBe("loading");

    act(() => result.current.selectNone());
    expect(result.current.status).toBe("idle");
    expect(onSelect).toHaveBeenCalledWith(noIcon());

    await act(async () => {
      load.resolve(loaded);
      await load.promise;
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  });

  it("デコードが上限で失敗したら理由を伝え、親へ通知しない", async () => {
    const load = deferred<DecodedIconImage>();
    decode.mockReturnValueOnce(load.promise);
    const { result, onSelect } = setup();

    act(() => result.current.selectImage(pngFile()));
    await act(async () => {
      load.reject(new IconImageError("dimension"));
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toEqual({ reason: "dimension", fileName: "a.png" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("受け付けない形式はデコードせずに拒否する", () => {
    const { result, onSelect } = setup();
    act(() => result.current.selectImage(new File(["x"], "a.svg", { type: "image/svg+xml" })));

    expect(decode).not.toHaveBeenCalled();
    expect(result.current.error).toEqual({ reason: "type", fileName: "a.svg" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("画面から外れたら、あとから届く読み込み結果は捨てる", async () => {
    const load = deferred<DecodedIconImage>();
    decode.mockReturnValueOnce(load.promise);
    const { result, onSelect, unmount } = setup();

    act(() => result.current.selectImage(pngFile()));
    unmount();
    await act(async () => {
      load.resolve(loaded);
      await load.promise;
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
