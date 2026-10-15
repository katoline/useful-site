/**
 * ツールページ。features を組み合わせ、依存を注入する唯一の場所。
 *
 * QR 生成（qr-generation）とアイコン選択（icon-selection）は互いを知らず、
 * domain の型（QrSettings・IconSelection・IconArtwork）とページの状態だけでつなぐ。
 * アイコンの絵（IconArtwork）はそのまま生成エンジンの CenterIconInput として渡せる。
 *
 * 状態は useToolSession（`qr-code:` 接頭辞）に置き、言語切り替えで消えない。
 * 生成結果には入力のスナップショットを持たせ、いまの入力と一致するときだけ
 * プレビューと保存を有効にする（URL や設定を変えた直後に古い結果を保存させない）。
 */
import { Download } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { PageHeader } from "~/platform/shell/PageHeader";
import { useToolSession } from "~/platform/state/ToolSessionProvider";
import { Button } from "~/platform/ui/button";
import { Input } from "~/platform/ui/input";
import { Label } from "~/platform/ui/label";
import {
  IconPicker,
  type IconSelection,
  noIcon,
  useIconSelection,
} from "../../features/icon-selection";
import {
  createObjectUrl,
  DEFAULT_QR_SETTINGS,
  downloadBlob,
  evaluateReadability,
  type GeneratedQr,
  generateQrSvg,
  MAX_URL_BYTES,
  type PngSize,
  type QrSettings,
  qrFileName,
  releaseObjectUrl,
  renderPngBlob,
  validateQrSettings,
  validateQrUrl,
} from "../../features/qr-generation";
import { useQrI18n } from "../../i18n";
import { Faq } from "./faq";
import { SettingsPanel } from "./SettingsPanel";

const KEYS = {
  url: "qr-code:url",
  settings: "qr-code:settings",
  icon: "qr-code:icon",
} as const;

/** 生成結果と、それを生んだ入力のスナップショット。一致判定にだけ使う */
interface QrResult {
  readonly generated: GeneratedQr;
  readonly url: string;
  readonly foreground: string;
  readonly pngSize: PngSize;
  readonly iconSizePercent: number;
  /** 参照で比較する（選択は変わるまで同じオブジェクトを使い回す） */
  readonly selection: IconSelection;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function ToolPage() {
  const { t } = useQrI18n();
  const urlId = useId();
  const hintId = useId();
  const urlErrorId = useId();

  const [urlInput, setUrlInput] = useToolSession<string>(KEYS.url, "");
  const [settings, setSettings] = useToolSession<QrSettings>(KEYS.settings, () =>
    validateQrSettings(DEFAULT_QR_SETTINGS),
  );
  const [selection, setSelection] = useToolSession<IconSelection>(KEYS.icon, () => noIcon());

  const [result, setResult] = useState<QrResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<"generate" | null>(null);
  const [savingPng, setSavingPng] = useState(false);

  const validation = useMemo(() => validateQrUrl(urlInput), [urlInput]);
  // QR に入れるのは入力そのもの（前後の空白だけ除いた生の文字列）。
  // validateQrUrl の正規化（parsed.href のパーセントエンコード）は検証の判定にだけ使い、
  // 日本語などの入力が不要に長い文字列へ膨らんで容量を超えないようにする。
  const qrUrl = urlInput.trim();

  const iconController = useIconSelection({
    selection,
    onSelect: useCallback((next: IconSelection) => setSelection(next), [setSelection]),
  });
  const artwork = iconController.artwork;

  // 入力が妥当なときだけ生成する。追い越された結果・取り消された結果は捨てる
  useEffect(() => {
    if (!validation.ok) {
      setError(null);
      return;
    }
    const url = qrUrl;
    let cancelled = false;
    setError(null);
    generateQrSvg(url, settings, artwork).then(
      (generated) => {
        if (cancelled) return;
        setResult({
          generated,
          url,
          foreground: settings.foreground,
          pngSize: settings.pngSize,
          iconSizePercent: settings.iconSizePercent,
          selection,
        });
      },
      () => {
        if (cancelled) return;
        setResult(null);
        setError("generate");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [validation.ok, qrUrl, settings, artwork, selection]);

  // プレビューの blob: URL を作り、差し替え・アンマウントで必ず解放する
  useEffect(() => {
    if (!result) return;
    const created = createObjectUrl(result.generated.svgBlob);
    setPreviewUrl(created);
    return () => {
      setPreviewUrl(null);
      releaseObjectUrl(created);
    };
  }, [result]);

  // いまの入力と一致する結果だけを有効とする。
  // 画像読み込み中やアイコンの読み込みエラー中は、古い結果でも保存させない
  const ready =
    result !== null &&
    validation.ok &&
    result.url === qrUrl &&
    result.foreground === settings.foreground &&
    result.pngSize === settings.pngSize &&
    result.iconSizePercent === settings.iconSizePercent &&
    result.selection === selection &&
    iconController.status !== "loading" &&
    iconController.error === null;

  const readable =
    result && ready
      ? evaluateReadability({
          moduleCount: result.generated.moduleCount,
          pngSize: settings.pngSize,
        })
      : null;
  const canSavePng = Boolean(ready && readable?.ok);
  const canSaveSvg = ready;
  const showResolutionHint = ready && readable !== null && !readable.ok;

  const urlError = useMemo(() => {
    if (validation.ok) return null;
    switch (validation.error) {
      case "empty":
        return null;
      case "scheme":
        return t("errors.scheme");
      case "too-long":
        return t("errors.tooLong", { limit: MAX_URL_BYTES });
      case "invalid":
        return t("errors.host");
    }
  }, [validation, t]);

  const saveSvg = () => {
    if (!result || !canSaveSvg) return;
    downloadBlob(result.generated.svgBlob, qrFileName(hostOf(result.url), "svg"));
  };

  const savePng = () => {
    if (!result || !canSavePng || savingPng) return;
    setSavingPng(true);
    renderPngBlob(result.generated.svg, result.pngSize).then(
      (blob) => {
        downloadBlob(blob, qrFileName(hostOf(result.url), "png"));
        setSavingPng(false);
      },
      () => {
        setSavingPng(false);
        setError("generate");
      },
    );
  };

  let preview: ReactNode;
  if (!validation.ok) {
    // 空欄の案内と、不正な URL の結果案内は別物として出し分ける
    preview =
      validation.error === "empty" ? (
        <p className="text-sm text-muted-foreground" data-testid="qr-empty">
          {t("url.empty")}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="qr-invalid">
          {t("result.invalid")}
        </p>
      );
  } else if (error === "generate") {
    preview = (
      <p role="alert" className="text-sm text-destructive" data-testid="qr-generate-error">
        {t("errors.generate")}
      </p>
    );
  } else if (iconController.status === "loading") {
    preview = (
      <p role="status" className="text-sm text-muted-foreground">
        {t("icon.choosing")}
      </p>
    );
  } else if (iconController.error) {
    preview = (
      <p role="alert" className="text-sm text-destructive" data-testid="qr-icon-blocked">
        {t("errors.iconBlocked")}
      </p>
    );
  } else if (!ready || !previewUrl) {
    preview = (
      <p role="status" className="text-sm text-muted-foreground" data-testid="qr-generating">
        {t("result.generating")}
      </p>
    );
  } else {
    preview = (
      <img
        data-testid="qr-preview"
        src={previewUrl}
        alt={t("result.title")}
        className="aspect-square h-auto w-full max-w-[320px] rounded-md border border-border bg-white"
      />
    );
  }

  return (
    <>
      <PageHeader title={t("page.title")} lead={t("page.lead")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={urlId}>{t("url.label")}</Label>
        <Input
          id={urlId}
          data-testid="qr-url"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder={t("url.placeholder")}
          value={urlInput}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={urlError ? `${hintId} ${urlErrorId}` : hintId}
          onChange={(event) => setUrlInput(event.currentTarget.value)}
        />
        <p id={hintId} className="text-sm text-muted-foreground">
          {t("url.hint")}
        </p>
        {urlError ? (
          <p
            id={urlErrorId}
            role="alert"
            className="text-sm text-destructive"
            data-testid="qr-url-error"
          >
            {urlError}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="qr-settings-title"
            className="rounded-lg border border-border p-4"
          >
            <h2 id="qr-settings-title" className="mb-3 text-lg font-semibold">
              {t("settings.title")}
            </h2>
            <SettingsPanel settings={settings} onChange={setSettings} />
          </section>

          <section aria-labelledby="qr-icon-title" className="rounded-lg border border-border p-4">
            <h2 id="qr-icon-title" className="mb-3 text-lg font-semibold">
              {t("icon.title")}
            </h2>
            <IconPicker
              selection={selection}
              status={iconController.status}
              error={iconController.error}
              onSelectNone={iconController.selectNone}
              onSelectBuiltin={iconController.selectBuiltin}
              onSelectImage={iconController.selectImage}
              onDismissError={iconController.dismissError}
            />
          </section>
        </div>

        <section
          aria-labelledby="qr-result-title"
          data-testid="qr-result"
          className="flex flex-col gap-3 rounded-lg border border-border p-4 md:sticky md:top-20 md:self-start"
        >
          <h2 id="qr-result-title" className="text-lg font-semibold">
            {t("result.title")}
          </h2>
          <div className="flex justify-center">{preview}</div>
          {showResolutionHint ? (
            <p role="status" className="text-sm text-destructive" data-testid="qr-resolution-hint">
              {t("errors.resolution", { size: `${readable?.minPngSize ?? 2048}px` })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={savePng}
              disabled={!canSavePng || savingPng}
              data-testid="qr-save-png"
            >
              <Download aria-hidden />
              {t("result.savePng")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={saveSvg}
              disabled={!canSaveSvg}
              data-testid="qr-save-svg"
            >
              <Download aria-hidden />
              {t("result.saveSvg")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("result.caution")}</p>
        </section>
      </div>

      <Faq />
    </>
  );
}
