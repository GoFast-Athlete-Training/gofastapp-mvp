import type { WorkoutType } from "@prisma/client";

const WORKOUT_TYPES: WorkoutType[] = [
  "Easy",
  "Tempo",
  "Intervals",
  "LongRun",
  "Race",
  "SpeedDuration",
];

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

const PACE_ANCHORS = new Set(["currentBuildup", "mpSimulation"]);
const MP_BLOCK_POSITIONS = new Set(["BACK_HALF", "FRONT_HALF", "EVEN"]);
const MP_BLOCK_PROGRESSIONS = new Set(["flat", "progressive"]);

export type CatalogueRowInput = {
  name: string;
  description: string | null;
  workoutType: WorkoutType;
  intendedPhase: string[];
  isQuality: boolean;
  isLongRunQuality: boolean;
  isLadder: boolean;
  paceAnchor: string;
  mpFraction: number | null;
  mpBlockPosition: string | null;
  mpBlockProgression: string;
  ladderStepMeters: number | null;
  minLadderMeters: number | null;
  maxLadderMeters: number | null;
  progressionIndex: number | null;
  workBaseReps?: number | null;
  workBaseRepMeters?: number | null;
  recoveryDistanceMeters?: number | null;
  warmupMiles?: number | null;
  warmupPaceOffsetSecPerMile?: number | null;
  cooldownMiles?: number | null;
  cooldownPaceOffsetSecPerMile?: number | null;
  workBaseMiles?: number | null;
  workPaceOffsetSecPerMile?: number | null;
  workBasePaceOffsetSecPerMile?: number | null;
  recoveryPaceOffsetSecPerMile?: number | null;
  isMP: boolean;
  mpTotalMiles?: number | null;
  mpPaceOffsetSecPerMile?: number | null;
  intendedHeartRateZone?: string | null;
  intendedHRBpmLow?: number | null;
  intendedHRBpmHigh?: number | null;
  notes?: string | null;
  /** Lowercase kebab-case. Omitted in payload = leave existing value on update. */
  slug?: string | null;
};

function pickNum(body: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = body[k];
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickBool(body: Record<string, unknown>, keys: string[]): boolean {
  for (const k of keys) {
    const v = body[k];
    if (v === true || v === "true" || v === "1" || v === 1) return true;
  }
  return false;
}

export function bodyToCatalogueRow(body: Record<string, unknown>): {
  ok: true;
  data: CatalogueRowInput;
} | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "name is required" };

  const wt = parseWorkoutType(body.workoutType);
  if (!wt) {
    return {
      ok: false,
      error: "workoutType must be Easy, Tempo, Intervals, LongRun, Race, or SpeedDuration",
    };
  }

  let progressionIndex: number | null = null;
  if (
    body.progressionIndex !== null &&
    body.progressionIndex !== undefined &&
    body.progressionIndex !== ""
  ) {
    const pi = Number(body.progressionIndex);
    if (!Number.isFinite(pi)) {
      return { ok: false, error: "progressionIndex must be a number or empty" };
    }
    progressionIndex = Math.round(pi);
  }

  const isQuality = pickBool(body, ["isQuality"]);
  const isLongRunQuality = pickBool(body, ["isLongRunQuality"]);
  const isLadder = pickBool(body, ["isLadder", "isLadderCapable"]);

  let paceAnchor = "currentBuildup";
  if (typeof body.paceAnchor === "string" && body.paceAnchor.trim()) {
    const pa = body.paceAnchor.trim();
    if (!PACE_ANCHORS.has(pa)) {
      return {
        ok: false,
        error: "paceAnchor must be currentBuildup or mpSimulation",
      };
    }
    paceAnchor = pa;
  }

  let mpBlockProgression = "flat";
  if (typeof body.mpBlockProgression === "string" && body.mpBlockProgression.trim()) {
    const p = body.mpBlockProgression.trim().toLowerCase();
    if (!MP_BLOCK_PROGRESSIONS.has(p)) {
      return {
        ok: false,
        error: "mpBlockProgression must be flat or progressive",
      };
    }
    mpBlockProgression = p;
  }

  let mpBlockPosition: string | null = null;
  if (typeof body.mpBlockPosition === "string" && body.mpBlockPosition.trim()) {
    const pos = body.mpBlockPosition.trim().toUpperCase();
    if (!MP_BLOCK_POSITIONS.has(pos)) {
      return {
        ok: false,
        error: "mpBlockPosition must be BACK_HALF, FRONT_HALF, or EVEN",
      };
    }
    mpBlockPosition = pos;
  }

  const intendedPhase = parseIntendedPhase(body.intendedPhase);
  if (intendedPhase.length === 0) {
    return { ok: false, error: "intendedPhase must have at least one phase (e.g. base,build)" };
  }

  let slug: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(body, "slug")) {
    if (body.slug === null || body.slug === undefined || body.slug === "") {
      slug = null;
    } else if (typeof body.slug === "string") {
      const s = body.slug.trim().toLowerCase();
      if (s.length === 0) {
        slug = null;
      } else if (!/^[a-z0-9-]+$/.test(s)) {
        return { ok: false, error: "slug must be lowercase kebab-case (a-z, 0-9, hyphens)" };
      } else {
        slug = s;
      }
    } else {
      return { ok: false, error: "slug must be a string, null, or empty" };
    }
  }

  const num = (k: string) => {
    const v = body[k];
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  let mpFraction: number | null = null;
  if (body.mpFraction !== null && body.mpFraction !== undefined && body.mpFraction !== "") {
    const mf = Number(body.mpFraction);
    if (!Number.isFinite(mf) || mf < 0 || mf > 1) {
      return { ok: false, error: "mpFraction must be between 0 and 1" };
    }
    mpFraction = mf;
  }

  const workBaseRepsRaw = pickNum(body, ["workBaseReps", "reps"]);
  const workBaseRepMetersRaw = pickNum(body, ["workBaseRepMeters", "repDistanceMeters"]);
  const workPaceOffsetRaw = pickNum(body, ["workPaceOffsetSecPerMile", "overallPaceOffsetSecPerMile"]);
  const workBasePaceRaw = pickNum(body, ["workBasePaceOffsetSecPerMile", "repPaceOffsetSecPerMile"]);

  let isMP = pickBool(body, ["isMP"]);
  if (!isMP && isLongRunQuality) isMP = true;

  return {
    ok: true,
    data: {
      name,
      description:
        typeof body.description === "string" ? body.description.trim() || null : null,
      workoutType: wt,
      intendedPhase,
      isQuality,
      isLongRunQuality,
      isLadder,
      paceAnchor,
      mpFraction,
      mpBlockPosition,
      mpBlockProgression,
      ladderStepMeters:
        num("ladderStepMeters") != null ? Math.round(num("ladderStepMeters")!) : null,
      minLadderMeters:
        num("minLadderMeters") != null ? Math.round(num("minLadderMeters")!) : null,
      maxLadderMeters:
        num("maxLadderMeters") != null ? Math.round(num("maxLadderMeters")!) : null,
      progressionIndex,
      workBaseReps: workBaseRepsRaw != null ? Math.round(workBaseRepsRaw) : null,
      workBaseRepMeters: workBaseRepMetersRaw != null ? Math.round(workBaseRepMetersRaw) : null,
      recoveryDistanceMeters:
        num("recoveryDistanceMeters") != null
          ? Math.round(num("recoveryDistanceMeters")!)
          : null,
      warmupMiles: num("warmupMiles"),
      warmupPaceOffsetSecPerMile:
        num("warmupPaceOffsetSecPerMile") != null
          ? Math.round(num("warmupPaceOffsetSecPerMile")!)
          : null,
      cooldownMiles: num("cooldownMiles"),
      cooldownPaceOffsetSecPerMile:
        num("cooldownPaceOffsetSecPerMile") != null
          ? Math.round(num("cooldownPaceOffsetSecPerMile")!)
          : null,
      workBaseMiles: num("workBaseMiles"),
      workPaceOffsetSecPerMile:
        workPaceOffsetRaw != null ? Math.round(workPaceOffsetRaw) : null,
      workBasePaceOffsetSecPerMile:
        workBasePaceRaw != null ? Math.round(workBasePaceRaw) : null,
      recoveryPaceOffsetSecPerMile:
        num("recoveryPaceOffsetSecPerMile") != null
          ? Math.round(num("recoveryPaceOffsetSecPerMile")!)
          : null,
      isMP,
      mpTotalMiles: num("mpTotalMiles"),
      mpPaceOffsetSecPerMile:
        num("mpPaceOffsetSecPerMile") != null
          ? Math.round(num("mpPaceOffsetSecPerMile")!)
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
      ...(slug !== undefined ? { slug } : {}),
    },
  };
}
