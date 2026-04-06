/** Stepper cap for minutes/mile; typing can still enter higher via keyboard. */
export const PACE_MIN_STEPPER_MAX = 99;

export function secPerMileToSplitStrings(totalSec: number): { min: string; sec: string } {
  const rounded = Math.max(0, Math.round(totalSec));
  return {
    min: String(Math.floor(rounded / 60)),
    sec: String(rounded % 60).padStart(2, "0"),
  };
}

export function paceSecondsStepperDisplay(secValue: string): string {
  const t = secValue.trim();
  if (t === "") return "";
  const digits = t.replace(/\D/g, "");
  if (digits === "") return "";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  return String(Math.min(59, n)).padStart(2, "0");
}

/** Combine min + sec inputs to total seconds per mile; empty fields → NaN. */
export function parseSplitPaceToSecPerMile(
  minStr: string,
  secStr: string,
  contextLabel: string,
  boundLabel: string
): number {
  const minT = minStr.trim();
  const secT = secStr.trim();
  if (!minT && !secT) return NaN;
  const m = minT === "" ? 0 : parseInt(minT, 10);
  const s = secT === "" ? 0 : parseInt(secT, 10);
  if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0 || s > 59) {
    throw new Error(
      `${contextLabel}: invalid pace ${boundLabel} — use minutes ≥ 0 and seconds 0–59`
    );
  }
  const total = m * 60 + s;
  if (total <= 0) return NaN;
  return total;
}
