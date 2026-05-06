import type { Prisma, WorkoutType } from "@prisma/client";

const WORKOUT_TYPES: WorkoutType[] = [
  "Easy",
  "Tempo",
  "Intervals",
  "LongRun",
  "Race",
];

export function parseWorkoutType(raw: unknown): WorkoutType | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "SpeedDuration") return "Tempo";
  if (t === "Interval") return "Intervals";
  return WORKOUT_TYPES.includes(t as WorkoutType) ? (t as WorkoutType) : null;
}

/** Free-form purpose sentences (AI, manual entry, CSV); trimmed and deduped. */
function parseTrainingIntentBody(body: Record<string, unknown>): string[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(body, "trainingIntent")) return undefined;
  const raw = body.trainingIntent;
  if (raw === null || raw === undefined || raw === "") return [];
  const uniq = new Set<string>();
  if (Array.isArray(raw)) {
    for (const v of raw) {
      if (typeof v !== "string") continue;
      const t = v.trim();
      if (t) uniq.add(t);
    }
    return [...uniq];
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t) uniq.add(t);
    return [...uniq];
  }
  return [];
}

const MP_BLOCK_POSITIONS = new Set(["BACK_HALF", "FRONT_HALF", "EVEN"]);
const MP_BLOCK_PROGRESSIONS = new Set(["flat", "progressive"]);

/**
 * Bulk / CSV-friendly pace anchor: matches DB default when omitted.
 * Accepts canonical tokens plus common spreadsheet variants (case/spacing insensitive).
 */
export function normalizePaceAnchorInput(raw: unknown): {
  ok: true;
  value: "currentBuildup" | "mpSimulation";
} | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: "currentBuildup" };
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error:
        "paceAnchor must be a string or omitted (use currentBuildup or mpSimulation)",
    };
  }
  const t = raw.trim();
  if (!t) return { ok: true, value: "currentBuildup" };

  if (t === "currentBuildup" || t === "mpSimulation") {
    return { ok: true, value: t };
  }

  const k = t.toLowerCase().replace(/[\s_-]/g, "");

  const currentAliases = new Set([
    "currentbuildup",
    "5k",
    "fivek",
    "vs5k",
    "fitness",
    "buildup",
    "current",
    "currentfitness",
  ]);
  const mpAliases = new Set([
    "mpsimulation",
    "mp",
    "marathon",
    "goalrace",
    "marathonpace",
    "marathonpacesimulation",
    "mppacesimulation",
    "racegoal",
  ]);

  if (currentAliases.has(k)) return { ok: true, value: "currentBuildup" };
  if (mpAliases.has(k)) return { ok: true, value: "mpSimulation" };

  return {
    ok: false,
    error:
      "paceAnchor must be currentBuildup or mpSimulation (CSV aliases: 5k, fitness, mp, marathon, …)",
  };
}

/** Lists of segments, or blockRepeat objects ({ layout, segments, repeatCount, ... }). */
function isValidSegmentPaceDistParsed(v: unknown): boolean {
  if (Array.isArray(v)) return true;
  if (v == null || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (o.layout !== "blockRepeat") return false;
  return Array.isArray(o.segments) && o.segments.length > 0;
}

/**
 * Accepts `segmentPaceDist` (preferred), or legacy `segmentPatternJson` / `workSegmentsJson` on API bodies.
 */
function parseSegmentPaceDist(
  body: Record<string, unknown>
): { ok: true; value: Prisma.InputJsonValue | null } | { ok: false; error: string } {
  const hasPd = Object.prototype.hasOwnProperty.call(body, "segmentPaceDist");
  const hasPat = Object.prototype.hasOwnProperty.call(body, "segmentPatternJson");
  const hasLegacy = Object.prototype.hasOwnProperty.call(body, "workSegmentsJson");
  if (!hasPd && !hasPat && !hasLegacy) {
    return { ok: true, value: null };
  }
  const raw = hasPd ? body.segmentPaceDist : hasPat ? body.segmentPatternJson : body.workSegmentsJson;
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (Array.isArray(raw)) {
    return { ok: true, value: raw as Prisma.InputJsonValue };
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    if (!isValidSegmentPaceDistParsed(raw)) {
      return {
        ok: false,
        error:
          "segmentPaceDist object must be blockRepeat: { layout: \"blockRepeat\", segments: [...], repeatCount, ... }",
      };
    }
    return { ok: true, value: raw as Prisma.InputJsonValue };
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isValidSegmentPaceDistParsed(parsed)) {
        return {
          ok: false,
          error:
            "segmentPaceDist must be a JSON array or blockRepeat object ({ layout, segments, repeatCount })",
        };
      }
      return { ok: true, value: parsed as Prisma.InputJsonValue };
    } catch {
      return { ok: false, error: "segmentPaceDist must be valid JSON" };
    }
  }
  return { ok: false, error: "segmentPaceDist must be an array, blockRepeat object, JSON string, or null" };
}

export type CatalogueRowInput = {
  name: string;
  runSubType: string | null;
  description: string | null;
  workoutType: WorkoutType;
  segmentPaceDist: Prisma.InputJsonValue | null;
  warmupFraction: number | null;
  workFraction: number | null;
  cooldownFraction: number | null;
  paceAnchor: string;
  mpFraction: number | null;
  mpBlockPosition: string | null;
  mpBlockProgression: string;
  workBaseReps: number | null;
  workBaseRepMeters: number | null;
  recoveryDistanceMeters: number | null;
  recoveryDurationSeconds: number | null;
  warmupMiles: number | null;
  warmupPaceOffsetSecPerMile: number | null;
  cooldownMiles: number | null;
  cooldownPaceOffsetSecPerMile: number | null;
  workBaseMiles: number | null;
  workPaceOffsetSecPerMile: number | null;
  workBasePaceOffsetSecPerMile: number | null;
  recoveryPaceOffsetSecPerMile: number | null;
  mpTotalMiles: number | null;
  mpPaceOffsetSecPerMile: number | null;
  intendedHeartRateZone: string | null;
  intendedHRBpmLow: number | null;
  intendedHRBpmHigh: number | null;
  notes: string | null;
  /** Free-form purpose sentences; omit from bulk row = leave existing on update (undefined). */
  trainingIntent?: string[];
  /** Omitted in payload = leave existing value on update. */
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

/** null = absent/empty, NaN = invalid */
function optFraction0to1(body: Record<string, unknown>, key: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return null;
  const v = body[key];
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return Number.NaN;
  return n;
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
      error: "workoutType must be Easy, Tempo, Intervals, LongRun, or Race (legacy: SpeedDuration → Tempo)",
    };
  }

  const wj = parseSegmentPaceDist(body);
  if (!wj.ok) return wj;

  const paceParsed = normalizePaceAnchorInput(body.paceAnchor);
  if (!paceParsed.ok) return paceParsed;
  const paceAnchor = paceParsed.value;

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

  const warmupF = optFraction0to1(body, "warmupFraction");
  const workF = optFraction0to1(body, "workFraction");
  const cooldownF = optFraction0to1(body, "cooldownFraction");
  if (Number.isNaN(warmupF!) || Number.isNaN(workF!) || Number.isNaN(cooldownF!)) {
    return { ok: false, error: "warmupFraction, workFraction, cooldownFraction must be between 0 and 1" };
  }

  let mpFraction: number | null = null;
  if (body.mpFraction !== null && body.mpFraction !== undefined && body.mpFraction !== "") {
    const mf = Number(body.mpFraction);
    if (!Number.isFinite(mf) || mf < 0 || mf > 1) {
      return { ok: false, error: "mpFraction must be between 0 and 1" };
    }
    mpFraction = mf;
  }

  const workPaceOffsetRaw = pickNum(body, ["workPaceOffsetSecPerMile", "overallPaceOffsetSecPerMile"]);
  const workBasePaceRaw = pickNum(body, ["workBasePaceOffsetSecPerMile", "repPaceOffsetSecPerMile"]);

  let runSubType: string | null = null;
  if (typeof body.runSubType === "string" && body.runSubType.trim()) {
    runSubType = body.runSubType.trim();
  } else if (body.runSubType === null) {
    runSubType = null;
  } else if (body.runSubType !== undefined) {
    return { ok: false, error: "runSubType must be a string or null" };
  }

  const trainingIntent = parseTrainingIntentBody(body);

  return {
    ok: true,
    data: {
      name,
      runSubType,
      description:
        typeof body.description === "string" ? body.description.trim() || null : null,
      workoutType: wt,
      segmentPaceDist: wj.value,
      warmupFraction: warmupF,
      workFraction: workF,
      cooldownFraction: cooldownF,
      paceAnchor,
      mpFraction,
      mpBlockPosition,
      mpBlockProgression,
      workBaseReps: pickNum(body, ["workBaseReps", "reps"]) != null
        ? Math.round(pickNum(body, ["workBaseReps", "reps"])!)
        : null,
      workBaseRepMeters:
        pickNum(body, ["workBaseRepMeters", "repDistanceMeters"]) != null
          ? Math.round(pickNum(body, ["workBaseRepMeters", "repDistanceMeters"])!)
          : null,
      recoveryDistanceMeters:
        num("recoveryDistanceMeters") != null
          ? Math.round(num("recoveryDistanceMeters")!)
          : null,
      recoveryDurationSeconds:
        (() => {
          const v = pickNum(body, ["recoveryDurationSeconds", "recoveryBetweenRepsSeconds"]);
          return v != null ? Math.round(v) : null;
        })(),
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
      ...(trainingIntent !== undefined ? { trainingIntent } : {}),
      ...(slug !== undefined ? { slug } : {}),
    },
  };
}
