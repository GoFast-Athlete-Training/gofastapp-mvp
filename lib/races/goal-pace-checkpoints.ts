export type GoalPaceCheckpoint = {
  label: string;
  atMi: number;
  elapsedSec: number;
};

const METERS_5K = 5000;
const METERS_10K = 10_000;
const METERS_HALF = 21_097.5;
const MILES_10K = 6.2;
const MILES_HALF = 13.1;

/** Skip marks this close to the finish — Finish row covers the line. */
const MIN_METERS_BEFORE_FINISH = 400;

type DistanceMark = { label: string; meters: number };

const LONG_COURSE_MARKS: DistanceMark[] = [
  { label: "10K", meters: METERS_10K },
  { label: "20K", meters: 20_000 },
  { label: "Half", meters: METERS_HALF },
  { label: "30K", meters: 30_000 },
  { label: "40K", meters: 40_000 },
];

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

  function shouldIncludeMark(markMeters: number): boolean {
    if (markMeters > raceMeters + 1) return false;
    if (markMeters < raceMeters - MIN_METERS_BEFORE_FINISH) return true;
    const snapTolerance = Math.max(200, raceMeters * 0.02);
    return Math.abs(raceMeters - markMeters) <= snapTolerance;
  }

  function pushMark(candidates: GoalPaceCheckpoint[], mark: DistanceMark) {
    if (!shouldIncludeMark(mark.meters)) return;
    candidates.push({
      label: mark.label,
      atMi: mark.meters / 1609.344,
      elapsedSec: elapsedAtMeters(mark.meters),
    });
  }

  const candidates: GoalPaceCheckpoint[] = [];

  if (totalMiles <= 13.5) {
    pushMark(candidates, { label: "5K", meters: METERS_5K });
  }

  if (totalMiles > MILES_HALF + 0.05) {
    for (const mark of LONG_COURSE_MARKS) {
      pushMark(candidates, mark);
    }
  } else if (totalMiles > MILES_10K + 0.05) {
    pushMark(candidates, { label: "10K", meters: METERS_10K });
    pushMark(candidates, { label: "20K", meters: 20_000 });
    pushMark(candidates, { label: "Half", meters: METERS_HALF });
  } else if (totalMiles > 3.5) {
    pushMark(candidates, { label: "10K", meters: METERS_10K });
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
      const key = c.label === "Finish" ? "Finish" : `${c.label}-${c.atMi.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.elapsedSec - b.elapsedSec)
    .map((c) => ({
      label: c.label,
      atMi: c.label === "Finish" ? totalMiles : c.atMi,
      elapsedSec: c.elapsedSec,
    }));
}
