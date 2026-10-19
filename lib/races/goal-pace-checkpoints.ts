export type GoalPaceCheckpoint = {
  label: string;
  atMi: number;
  elapsedSec: number;
};

/** Even-pace elapsed times at standard marks for the slim race plan card. */
export function goalPaceCheckpoints(
  totalMiles: number,
  goalPaceSecPerMi: number
): GoalPaceCheckpoint[] {
  if (
    !Number.isFinite(totalMiles) ||
    totalMiles <= 0 ||
    !Number.isFinite(goalPaceSecPerMi) ||
    goalPaceSecPerMi <= 0
  ) {
    return [];
  }

  const candidates: Array<{ label: string; atMi: number }> = [];

  if (totalMiles <= 13.5) {
    candidates.push({ label: "5K", atMi: 3.1 });
  }
  if (totalMiles > 6.2 + 0.05) {
    candidates.push({ label: "10K", atMi: 6.2 });
  }
  if (totalMiles > 13.1 + 0.05) {
    candidates.push({ label: "Half", atMi: 13.1 });
  }
  candidates.push({ label: "Finish", atMi: totalMiles });

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
      ...c,
      atMi: c.label === "Finish" ? totalMiles : c.atMi,
      elapsedSec: goalPaceSecPerMi * (c.label === "Finish" ? totalMiles : c.atMi),
    }));
}
