export type PhaseWeekPinWorkoutType = "Tempo" | "LongRun" | "Intervals";

export type PhaseWeekPin = {
  workoutType: PhaseWeekPinWorkoutType;
  catalogueWorkoutId: string;
};

export type PhaseWeekRow = {
  weekIndex: number;
  totalMilesCap: number | null;
  longRunCapMiles: number | null;
  pins: PhaseWeekPin[];
};

export function parsePhaseWeekRows(raw: unknown): PhaseWeekRow[] {
  const base = [1, 2, 3, 4].map((weekIndex) => ({
    weekIndex,
    totalMilesCap: null as number | null,
    longRunCapMiles: null as number | null,
    pins: [] as PhaseWeekPin[],
  }));
  if (!Array.isArray(raw)) return base;
  return base.map((row) => {
    const found = raw.find((item) => {
      if (item == null || typeof item !== "object") return false;
      return Number((item as Record<string, unknown>).weekIndex) === row.weekIndex;
    }) as Record<string, unknown> | undefined;
    if (!found) return row;
    const pinsRaw = found.pins;
    const pins: PhaseWeekPin[] = [];
    if (Array.isArray(pinsRaw)) {
      for (const p of pinsRaw) {
        if (p == null || typeof p !== "object") continue;
        const po = p as Record<string, unknown>;
        const wt = po.workoutType;
        const id = typeof po.catalogueWorkoutId === "string" ? po.catalogueWorkoutId : "";
        if (
          (wt === "Tempo" || wt === "LongRun" || wt === "Intervals") &&
          id
        ) {
          pins.push({ workoutType: wt, catalogueWorkoutId: id });
        }
      }
    }
    const numOrNull = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    return {
      weekIndex: row.weekIndex,
      totalMilesCap: numOrNull(found.totalMilesCap),
      longRunCapMiles: numOrNull(found.longRunCapMiles),
      pins,
    };
  });
}

export function phaseWeekRowsFromLegacyTaper(taper: {
  week1TotalMiles: number | null;
  week1LongRunMiles: number | null;
  week2TotalMiles: number | null;
  week2LongRunMiles: number | null;
  weeks?: PhaseWeekRow[];
}): PhaseWeekRow[] {
  if (taper.weeks && taper.weeks.length > 0) return taper.weeks;
  const parsed = parsePhaseWeekRows(null);
  return parsed.map((row) => {
    if (row.weekIndex === 1) {
      return {
        ...row,
        totalMilesCap: taper.week1TotalMiles,
        longRunCapMiles: taper.week1LongRunMiles,
      };
    }
    if (row.weekIndex === 2) {
      return {
        ...row,
        totalMilesCap: taper.week2TotalMiles,
        longRunCapMiles: taper.week2LongRunMiles,
      };
    }
    return row;
  });
}
