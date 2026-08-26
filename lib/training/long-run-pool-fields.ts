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
