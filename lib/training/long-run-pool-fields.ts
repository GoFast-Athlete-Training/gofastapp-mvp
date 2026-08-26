/**
 * Canonical long-run POOL field names — sum of 4 Saturday LRs per block, not weekly mileage.
 */

export type LongRunPoolTriplet = {
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
};

/** Read pool triplet from API body or stored JSON (accepts legacy baseMiles/peakMiles/taperMiles). */
export function readLongRunPoolFromRecord(
  raw: Record<string, unknown>,
  fallback: LongRunPoolTriplet
): LongRunPoolTriplet {
  const num = (v: unknown, fb: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  return {
    baseLongRunPoolMiles: num(
      raw.baseLongRunPoolMiles ?? raw.baseMiles ?? raw.baseLrPool,
      fallback.baseLongRunPoolMiles
    ),
    peakLongRunPoolMiles: num(
      raw.peakLongRunPoolMiles ?? raw.peakMiles ?? raw.peakLrPoolMax,
      fallback.peakLongRunPoolMiles
    ),
    taperLongRunPoolMiles: num(
      raw.taperLongRunPoolMiles ?? raw.taperMiles ?? raw.taperLrPool,
      fallback.taperLongRunPoolMiles
    ),
  };
}

export function clampPeakLongRunPoolMiles(value: number): number {
  const p = Number(value);
  if (!Number.isFinite(p) || p <= 0) {
    throw new Error("peakLongRunPoolMiles must be a positive number");
  }
  return Math.round(p * 10) / 10;
}

/** NORMAL 50–60, ELITE 60–70 marathon-style peak pools */
export function clampPeakLongRunPoolToBand(
  value: number,
  elite: boolean
): number {
  const min = elite ? 60 : 50;
  const max = elite ? 70 : 60;
  return clampPeakLongRunPoolMiles(Math.max(min, Math.min(max, value)));
}

export type PeakPoolBand = "good_strong" | "ready_to_pr";

export type FoundationPeakPoolComparisonRow = {
  band: PeakPoolBand;
  rangeLabel: string;
  meaning: string;
  isSelected: boolean;
};

const PEAK_POOL_COMPARISON: Record<
  PeakPoolBand,
  { rangeLabel: string; meaning: string; matches: (p: number) => boolean }
> = {
  good_strong: {
    rangeLabel: "50–60 mi",
    meaning: "Good / strong peak cycle — you're in good shape",
    matches: (p) => p >= 50 && p < 60,
  },
  ready_to_pr: {
    rangeLabel: "60–70 mi",
    meaning: "Ready to PR — you're in good shape",
    matches: (p) => p >= 60,
  },
};

/** Athlete-facing foundation key — peak pool total only, not per-Saturday split. */
export function peakLongRunPoolFoundationKey(
  peakPoolMiles: number
): string | null {
  const p = Number(peakPoolMiles);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (p >= 60) return PEAK_POOL_COMPARISON.ready_to_pr.meaning;
  if (p >= 50) return PEAK_POOL_COMPARISON.good_strong.meaning;
  return null;
}

export function peakLongRunPoolBand(peakPoolMiles: number): PeakPoolBand | null {
  const p = Number(peakPoolMiles);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (p >= 60) return "ready_to_pr";
  if (p >= 50) return "good_strong";
  return null;
}

/** Expandable peak pool key — canonical 50–60 and 60–70 bands. */
export function foundationPeakPoolComparisonRows(
  peakPoolMiles: number
): FoundationPeakPoolComparisonRow[] {
  const p = Number(peakPoolMiles);
  const selected = peakLongRunPoolBand(p);
  return (["good_strong", "ready_to_pr"] as const).map((band) => ({
    band,
    rangeLabel: PEAK_POOL_COMPARISON[band].rangeLabel,
    meaning: PEAK_POOL_COMPARISON[band].meaning,
    isSelected: selected === band,
  }));
}
