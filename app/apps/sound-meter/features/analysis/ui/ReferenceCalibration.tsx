/**
 * 基準に合わせる：同じ時間に同じ場所で測った基準の騒音計（市販の騒音計・校正済みのアプリ）の平均の値を入れると、
 * この計測の平均（Leq）がその値になるよう補正値を決める
 */
import { useId, useState } from "react";
import { Button } from "~/platform/ui/button";
import { Input } from "~/platform/ui/input";
import { Label } from "~/platform/ui/label";
import type { MeasurementSummary } from "../../../domain/measurement";
import { useSoundI18n } from "../../../i18n";
import { calibrationForReference } from "../core/settings";
import { dbUnit } from "./format";

export function ReferenceCalibration({
  summary,
  onCalibrate,
}: {
  summary: MeasurementSummary;
  onCalibrate(calibrationDb: number): void;
}) {
  const { t } = useSoundI18n();
  const id = useId();
  const [text, setText] = useState("");
  const value = Number(text);
  const valid = text.trim() !== "" && Number.isFinite(value) && value > 0 && value < 200;
  if (summary.audibleFrames === 0) return null;
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-lg border border-border p-4"
      data-testid="reference-calibration"
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {t("reference.title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("reference.hint")}</p>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          onCalibrate(calibrationForReference(value, summary.leqDbfs));
          setText("");
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={id}>
            {t("reference.label", { unit: dbUnit(summary.weighting.frequency) })}
          </Label>
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step={0.1}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-28"
            data-testid="reference-value"
          />
        </div>
        <Button type="submit" variant="outline" disabled={!valid} data-testid="reference-apply">
          {t("reference.apply")}
        </Button>
      </form>
    </section>
  );
}
