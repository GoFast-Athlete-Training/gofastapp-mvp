import type { PlanPhaseOutline, PlanWeekOutline } from "./plan-generate-ai-types";

/**
 * Ensure phases cover each week 1..totalWeeks exactly once (no gap, no double-booking).
 * Returns phases sorted by startWeek.
 */
export function validatePhasesCoverWeeks(
  phases: PlanPhaseOutline[],
  totalWeeks: number
): PlanPhaseOutline[] {
  if (phases.length === 0) {
    throw new Error("phases array must not be empty");
  }

  const sorted = [...phases].sort((a, b) => a.startWeek - b.startWeek);
  const owner: string[] = new Array(totalWeeks).fill("");

  for (const p of sorted) {
    if (
      !Number.isFinite(p.startWeek) ||
      !Number.isFinite(p.endWeek) ||
      p.startWeek > p.endWeek
    ) {
      throw new Error(`Invalid phase range for ${p.name}`);
    }
    for (let w = p.startWeek; w <= p.endWeek; w++) {
      if (w < 1 || w > totalWeeks) {
        throw new Error(`Phase "${p.name}" extends outside weeks 1..${totalWeeks}`);
      }
      const i = w - 1;
      if (owner[i]) {
        throw new Error(`Overlapping phases at week ${w}`);
      }
      owner[i] = p.name.trim() || "training";
    }
  }

  const firstGap = owner.findIndex((x) => !x);
  if (firstGap !== -1) {
    throw new Error(`Phases must cover every week; missing week ${firstGap + 1}`);
  }

  return sorted;
}

/** Single source of truth: each planWeek.phase matches the phase row for that week. */
export function applyWeekPhasesFromPhases(
  phases: PlanPhaseOutline[],
  planWeeks: PlanWeekOutline[]
): PlanWeekOutline[] {
  return planWeeks.map((w) => {
    const p = phases.find(
      (ph) => w.weekNumber >= ph.startWeek && w.weekNumber <= ph.endWeek
    );
    const phase = p?.name?.trim() || w.phase;
    return { ...w, phase };
  });
}
