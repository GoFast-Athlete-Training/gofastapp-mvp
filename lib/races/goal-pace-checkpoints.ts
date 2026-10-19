export type GoalPaceCheckpoint = {
  label: string;
  atMi: number;
  elapsedSec: number;
};

const METERS_5K = 5000;
const METERS_10K = 10_000;
const METERS_HALF = 21_097.5;
const MILES_5K = 3.1;
const MILES_10K = 6.2;
const MILES_HALF = 13.1;

/** Even-pace elapsed times at standard marks — slices of the goal clock, not rounded pace × miles. */
export function goalPaceCheckpoints(params: {
  goalSec: number;
  totalMiles: number;
  totalMeters?: number | null;
}): GoalPaceCheckpoint[] {
  const { goalSec, totalMiles } = params;

  if (
    !Number.isFinite(goalSec) ||
    goalSec <= 0 ||
    !Number.isFinite(totalMiles) ||
    totalMiles <= 0
  ) {
    return [];
  }

  const raceMeters =
    params.totalMeters != null && params.totalMeters > 0
      ? params.totalMeters
      : totalMiles * 1609.344;

  if (!Number.isFinite(raceMeters) || raceMeters <= 0) {
    return [];
  }

  function elapsedAtMeters(markMeters: number): number {
    return (goalSec * markMeters) / raceMeters;
  }

  const candidates: Array<{ label: string; atMi: number; elapsedSec: number }> = [];

  if (totalMiles <= 13.5) {
    candidates.push({
      label: "5K",
      atMi: MILES_5K,
      elapsedSec: elapsedAtMeters(METERS_5K),
    });
  }
  if (totalMiles > MILES_10K + 0.05) {
    candidates.push({
      label: "10K",
      atMi: MILES_10K,
      elapsedSec: elapsedAtMeters(METERS_10K),
    });
  }
  if (totalMiles > MILES_HALF + 0.05) {
    candidates.push({
      label: "Half",
      atMi: MILES_HALF,
      elapsedSec: elapsedAtMeters(METERS_HALF),
    });
  }
  candidates.push({
    label: "Finish",
    atMi: totalMiles,
    elapsedSec: goalSec,
  });

  const seen = new Set<string>();
  return candidates
    .filter((c) => c.atMi <= totalMiles + 0.05)
    .filter((c) => {
      const key = c.label === "Finish" ? "Finish" : `${c.label}-${c.atMi}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => ({
      label: c.label,
      atMi: c.label === "Finish" ? totalMiles : c.atMi,
      elapsedSec: c.elapsedSec,
    }));
}
