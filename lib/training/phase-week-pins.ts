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

export const PHASE_WEEK_LABELS = ["W1", "W2", "W3", "W4"] as const;

export function defaultPhaseWeekRows(weekCount = 4): PhaseWeekRow[] {
  const count = Math.max(1, Math.min(4, weekCount));
  return Array.from({ length: count }, (_, i) => ({
    weekIndex: i + 1,
    totalMilesCap: null,
    longRunCapMiles: null,
    pins: [],
  }));
}

export function defaultTaperPhaseWeekRows(): PhaseWeekRow[] {
  return defaultPhaseWeekRows(2);
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export function parsePhaseWeekRows(raw: unknown, weekCount = 4): PhaseWeekRow[] {
  const base = defaultPhaseWeekRows(weekCount);
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
    return {
      weekIndex: row.weekIndex,
      totalMilesCap: numOrNull(found.totalMilesCap),
      longRunCapMiles: numOrNull(found.longRunCapMiles),
      pins,
    };
  });
}

/** True when any taper week row has volume caps (preset-driven taper, not generic heuristics). */
export function presetTaperHasVolumeCaps(weeks: PhaseWeekRow[] | null | undefined): boolean {
  if (!weeks?.length) return false;
  return weeks.some(
    (r) =>
      (r.totalMilesCap != null && r.totalMilesCap > 0) ||
      (r.longRunCapMiles != null && r.longRunCapMiles > 0),
  );
}

/** Legacy taper week1/week2 scalars → first two chrome rows; weekPins wins when present. */
export function phaseWeekRowsFromLegacyTaper(taper: {
  week1TotalMiles: number | null;
  week1LongRunMiles: number | null;
  week2TotalMiles: number | null;
  week2LongRunMiles: number | null;
  weekPins?: unknown;
  weeks?: PhaseWeekRow[];
}): PhaseWeekRow[] {
  if (taper.weeks && taper.weeks.length > 0) return taper.weeks;
  const parsed = parsePhaseWeekRows(taper.weekPins, 2);
  const hasPinData = parsed.some(
    (r) => r.totalMilesCap != null || r.longRunCapMiles != null || r.pins.length > 0,
  );
  if (hasPinData) return parsed;
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

export function taperLegacyScalarsFromWeekRows(rows: PhaseWeekRow[]) {
  const w1 = rows.find((r) => r.weekIndex === 1);
  const w2 = rows.find((r) => r.weekIndex === 2);
  return {
    week1TotalMiles: w1?.totalMilesCap ?? null,
    week1LongRunMiles: w1?.longRunCapMiles ?? null,
    week2TotalMiles: w2?.totalMilesCap ?? null,
    week2LongRunMiles: w2?.longRunCapMiles ?? null,
    weekPins: rows,
  };
}
