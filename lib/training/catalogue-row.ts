import type { WorkoutType } from "@prisma/client";

const WORKOUT_TYPES: WorkoutType[] = ["Easy", "Tempo", "Intervals", "LongRun"];

export function parseWorkoutType(raw: unknown): WorkoutType | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return WORKOUT_TYPES.includes(t as WorkoutType) ? (t as WorkoutType) : null;
}

/** Accept string[] or comma-separated string from CSV import */
export function parseIntendedPhase(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x).trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,|]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export type CatalogueRowInput = {
  name: string;
  workoutType: WorkoutType;
  intendedPhase: string[];
  progressionIndex: number;
  reps?: number | null;
  repDistanceMeters?: number | null;
  recoveryDistanceMeters?: number | null;
  warmupMiles?: number | null;
  cooldownMiles?: number | null;
  repPaceOffsetSecPerMile?: number | null;
  recoveryPaceOffsetSecPerMile?: number | null;
  overallPaceOffsetSecPerMile?: number | null;
  intendedHeartRateZone?: string | null;
  intendedHRBpmLow?: number | null;
  intendedHRBpmHigh?: number | null;
  notes?: string | null;
};

export function bodyToCatalogueRow(body: Record<string, unknown>): {
  ok: true;
  data: CatalogueRowInput;
} | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "name is required" };

  const wt = parseWorkoutType(body.workoutType);
  if (!wt) return { ok: false, error: "workoutType must be Easy, Tempo, Intervals, or LongRun" };

  const progressionIndex = Number(body.progressionIndex);
  if (!Number.isFinite(progressionIndex)) {
    return { ok: false, error: "progressionIndex must be a number" };
  }

  const intendedPhase = parseIntendedPhase(body.intendedPhase);
  if (intendedPhase.length === 0) {
    return { ok: false, error: "intendedPhase must have at least one phase (e.g. base,build)" };
  }

  const num = (k: string) => {
    const v = body[k];
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    ok: true,
    data: {
      name,
      workoutType: wt,
      intendedPhase,
      progressionIndex: Math.round(progressionIndex),
      reps: num("reps") != null ? Math.round(num("reps")!) : null,
      repDistanceMeters:
        num("repDistanceMeters") != null ? Math.round(num("repDistanceMeters")!) : null,
      recoveryDistanceMeters:
        num("recoveryDistanceMeters") != null
          ? Math.round(num("recoveryDistanceMeters")!)
          : null,
      warmupMiles: num("warmupMiles"),
      cooldownMiles: num("cooldownMiles"),
      repPaceOffsetSecPerMile:
        num("repPaceOffsetSecPerMile") != null
          ? Math.round(num("repPaceOffsetSecPerMile")!)
          : null,
      recoveryPaceOffsetSecPerMile:
        num("recoveryPaceOffsetSecPerMile") != null
          ? Math.round(num("recoveryPaceOffsetSecPerMile")!)
          : null,
      overallPaceOffsetSecPerMile:
        num("overallPaceOffsetSecPerMile") != null
          ? Math.round(num("overallPaceOffsetSecPerMile")!)
          : null,
      intendedHeartRateZone:
        typeof body.intendedHeartRateZone === "string"
          ? body.intendedHeartRateZone.trim() || null
          : null,
      intendedHRBpmLow:
        num("intendedHRBpmLow") != null ? Math.round(num("intendedHRBpmLow")!) : null,
      intendedHRBpmHigh:
        num("intendedHRBpmHigh") != null ? Math.round(num("intendedHRBpmHigh")!) : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    },
  };
}
