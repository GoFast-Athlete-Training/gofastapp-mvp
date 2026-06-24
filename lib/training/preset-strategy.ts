import { Prisma } from "@prisma/client";

/** Canonical pace keys catalogue structures may reference. */
export const CANONICAL_PACE_KEYS = [
  "relaxed",
  "easy",
  "steady",
  "moderate",
  "threshold",
  "fiveKPace",
  "tenKPace",
  "marathonPace",
  "recoveryJog",
] as const;

export type CanonicalPaceKey = (typeof CANONICAL_PACE_KEYS)[number];

export type PaceProfileAnchor = "current5k" | "current10k" | "goalRacePace";

export type PaceProfileEntry = {
  anchor: PaceProfileAnchor;
  offsetSecPerMile: number;
};

export type PaceProfile = Partial<Record<CanonicalPaceKey | string, PaceProfileEntry>>;

export type WeeklyWorkoutComposition = {
  easy: number;
  tempo: number;
  intervals: number;
  longRun: number;
  cadenceWeeks: number;
};

export type CoachPlanOverview = {
  summary: string;
  weeklyVolume: { min: number; max: number | null };
  weeklyWorkoutComposition: WeeklyWorkoutComposition;
  longRunStructure?: {
    peakLongRunMiles?: number;
    cyclePoolAlignment?: string;
  };
  intervalStructure?: { intent: string; structureFamily: string };
  tempoStructure?: { intent: string; structureFamily: string };
  easyStructure?: { intent: string; structureFamily: string };
};

export type PresetStrategyFields = {
  coachIntent?: string | null;
  objectiveOfPlan?: string | null;
  athletePersonaCapability?:
    | "NON_RUNNER"
    | "BEGINNER"
    | "RECREATIONAL"
    | "COMPETITIVE"
    | "ELITE"
    | null;
  athletePersonaGoal?: string | null;
  athletePersonaDedication?: "LOW" | "MODERATE" | "HIGH" | "ELITE" | null;
  coachPlanOverview?: CoachPlanOverview | null;
  paceProfile?: PaceProfile | null;
};

const PERSONA_CAPABILITIES = new Set([
  "NON_RUNNER",
  "BEGINNER",
  "RECREATIONAL",
  "COMPETITIVE",
  "ELITE",
]);

const PERSONA_DEDICATIONS = new Set(["LOW", "MODERATE", "HIGH", "ELITE"]);

const PACE_ANCHORS = new Set(["current5k", "current10k", "goalRacePace"]);

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function parsePersonaCapability(v: unknown): PresetStrategyFields["athletePersonaCapability"] {
  if (v == null || v === "") return null;
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  return PERSONA_CAPABILITIES.has(s) ? (s as NonNullable<PresetStrategyFields["athletePersonaCapability"]>) : null;
}

function parsePersonaDedication(v: unknown): PresetStrategyFields["athletePersonaDedication"] {
  if (v == null || v === "") return null;
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  return PERSONA_DEDICATIONS.has(s) ? (s as NonNullable<PresetStrategyFields["athletePersonaDedication"]>) : null;
}

function numField(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function parseCoachPlanOverview(raw: unknown): CoachPlanOverview | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const summary = strOrNull(o.summary);
  if (!summary) return null;

  const wv =
    o.weeklyVolume && typeof o.weeklyVolume === "object" && !Array.isArray(o.weeklyVolume)
      ? (o.weeklyVolume as Record<string, unknown>)
      : {};
  const min = Math.max(1, Math.round(numField(wv.min, 15)));
  const maxRaw = wv.max;
  const max =
    maxRaw == null || maxRaw === ""
      ? null
      : Math.max(min + 1, Math.round(numField(maxRaw, min + 5)));

  const wc =
    o.weeklyWorkoutComposition &&
    typeof o.weeklyWorkoutComposition === "object" &&
    !Array.isArray(o.weeklyWorkoutComposition)
      ? (o.weeklyWorkoutComposition as Record<string, unknown>)
      : {};

  const weeklyWorkoutComposition: WeeklyWorkoutComposition = {
    easy: numField(wc.easy, 2),
    tempo: numField(wc.tempo, 1),
    intervals: numField(wc.intervals, 1),
    longRun: numField(wc.longRun, 1),
    cadenceWeeks: Math.max(1, Math.round(numField(wc.cadenceWeeks, 1))),
  };

  const parseStructure = (key: string) => {
    const block = o[key];
    if (block == null || typeof block !== "object" || Array.isArray(block)) return undefined;
    const b = block as Record<string, unknown>;
    const intent = strOrNull(b.intent);
    const structureFamily = strOrNull(b.structureFamily);
    if (!intent || !structureFamily) return undefined;
    return { intent, structureFamily };
  };

  const longRunStructure =
    o.longRunStructure && typeof o.longRunStructure === "object" && !Array.isArray(o.longRunStructure)
      ? (() => {
          const lr = o.longRunStructure as Record<string, unknown>;
          const out: NonNullable<CoachPlanOverview["longRunStructure"]> = {};
          if (lr.peakLongRunMiles != null && Number.isFinite(Number(lr.peakLongRunMiles))) {
            out.peakLongRunMiles = Number(lr.peakLongRunMiles);
          }
          const align = strOrNull(lr.cyclePoolAlignment);
          if (align) out.cyclePoolAlignment = align;
          return Object.keys(out).length ? out : undefined;
        })()
      : undefined;

  return {
    summary,
    weeklyVolume: { min, max },
    weeklyWorkoutComposition,
    longRunStructure,
    intervalStructure: parseStructure("intervalStructure"),
    tempoStructure: parseStructure("tempoStructure"),
    easyStructure: parseStructure("easyStructure"),
  };
}

export function parsePaceProfile(raw: unknown): PaceProfile | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: PaceProfile = {};
  for (const [key, val] of Object.entries(o)) {
    if (val == null || typeof val !== "object" || Array.isArray(val)) continue;
    const entry = val as Record<string, unknown>;
    const anchorRaw = typeof entry.anchor === "string" ? entry.anchor.trim() : "";
    if (!PACE_ANCHORS.has(anchorRaw)) continue;
    const off = Number(entry.offsetSecPerMile);
    if (!Number.isFinite(off)) continue;
    out[key] = {
      anchor: anchorRaw as PaceProfileAnchor,
      offsetSecPerMile: Math.round(off),
    };
  }
  return Object.keys(out).length ? out : null;
}

/** Default pace profile for beginner / 5K-fitness anchored presets. */
export function defaultPaceProfileForCapability(
  capability: PresetStrategyFields["athletePersonaCapability"]
): PaceProfile {
  const easyOffset = capability === "NON_RUNNER" || capability === "BEGINNER" ? 150 : 120;
  const steadyOffset = capability === "NON_RUNNER" || capability === "BEGINNER" ? 120 : 90;
  return {
    relaxed: { anchor: "current5k", offsetSecPerMile: easyOffset + 30 },
    easy: { anchor: "current5k", offsetSecPerMile: easyOffset },
    steady: { anchor: "current5k", offsetSecPerMile: steadyOffset },
    moderate: { anchor: "current5k", offsetSecPerMile: 60 },
    threshold: { anchor: "current5k", offsetSecPerMile: 20 },
    fiveKPace: { anchor: "current5k", offsetSecPerMile: 0 },
    tenKPace: { anchor: "current10k", offsetSecPerMile: 0 },
    marathonPace: { anchor: "goalRacePace", offsetSecPerMile: 0 },
    recoveryJog: { anchor: "current5k", offsetSecPerMile: easyOffset + 30 },
  };
}

export function parsePresetStrategyFromBody(
  body: Record<string, unknown>
): { ok: true; value: Partial<PresetStrategyFields> } | { ok: false; error: string } {
  const value: Partial<PresetStrategyFields> = {};
  const keys = [
    "coachIntent",
    "objectiveOfPlan",
    "athletePersonaCapability",
    "athletePersonaGoal",
    "athletePersonaDedication",
    "coachPlanOverview",
    "paceProfile",
  ] as const;

  const present = keys.some((k) => k in body);
  if (!present) return { ok: true, value: {} };

  if ("coachIntent" in body) {
    if (body.coachIntent === null) value.coachIntent = null;
    else {
      const s = strOrNull(body.coachIntent);
      if (!s) return { ok: false, error: "coachIntent must be a non-empty string or null" };
      value.coachIntent = s;
    }
  }

  if ("objectiveOfPlan" in body) {
    value.objectiveOfPlan = body.objectiveOfPlan === null ? null : strOrNull(body.objectiveOfPlan);
  }

  if ("athletePersonaCapability" in body) {
    const cap = parsePersonaCapability(body.athletePersonaCapability);
    if (body.athletePersonaCapability != null && body.athletePersonaCapability !== "" && !cap) {
      return { ok: false, error: "Invalid athletePersonaCapability" };
    }
    value.athletePersonaCapability = cap;
  }

  if ("athletePersonaGoal" in body) {
    value.athletePersonaGoal =
      body.athletePersonaGoal === null ? null : strOrNull(body.athletePersonaGoal);
  }

  if ("athletePersonaDedication" in body) {
    const ded = parsePersonaDedication(body.athletePersonaDedication);
    if (body.athletePersonaDedication != null && body.athletePersonaDedication !== "" && !ded) {
      return { ok: false, error: "Invalid athletePersonaDedication" };
    }
    value.athletePersonaDedication = ded;
  }

  if ("coachPlanOverview" in body) {
    if (body.coachPlanOverview === null) {
      value.coachPlanOverview = null;
    } else {
      const parsed = parseCoachPlanOverview(body.coachPlanOverview);
      if (!parsed) return { ok: false, error: "coachPlanOverview must be a valid overview object or null" };
      value.coachPlanOverview = parsed;
    }
  }

  if ("paceProfile" in body) {
    if (body.paceProfile === null) {
      value.paceProfile = null;
    } else {
      const parsed = parsePaceProfile(body.paceProfile);
      if (!parsed) return { ok: false, error: "paceProfile must be a valid pace key map or null" };
      value.paceProfile = parsed;
    }
  }

  return { ok: true, value };
}

export function presetStrategyToPrismaJson(
  fields: Partial<PresetStrategyFields>
): {
  coachIntent?: string | null;
  objectiveOfPlan?: string | null;
  athletePersonaCapability?: PresetStrategyFields["athletePersonaCapability"];
  athletePersonaGoal?: string | null;
  athletePersonaDedication?: PresetStrategyFields["athletePersonaDedication"];
  coachPlanOverview?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  paceProfile?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
} {
  const out: ReturnType<typeof presetStrategyToPrismaJson> = {};
  if ("coachIntent" in fields) out.coachIntent = fields.coachIntent ?? null;
  if ("objectiveOfPlan" in fields) out.objectiveOfPlan = fields.objectiveOfPlan ?? null;
  if ("athletePersonaCapability" in fields) {
    out.athletePersonaCapability = fields.athletePersonaCapability ?? null;
  }
  if ("athletePersonaGoal" in fields) out.athletePersonaGoal = fields.athletePersonaGoal ?? null;
  if ("athletePersonaDedication" in fields) {
    out.athletePersonaDedication = fields.athletePersonaDedication ?? null;
  }
  if ("coachPlanOverview" in fields) {
    out.coachPlanOverview =
      fields.coachPlanOverview == null
        ? Prisma.JsonNull
        : (fields.coachPlanOverview as Prisma.InputJsonValue);
  }
  if ("paceProfile" in fields) {
    out.paceProfile =
      fields.paceProfile == null ? Prisma.JsonNull : (fields.paceProfile as Prisma.InputJsonValue);
  }
  return out;
}

export function isCanonicalPaceKey(key: string): key is CanonicalPaceKey {
  return (CANONICAL_PACE_KEYS as readonly string[]).includes(key);
}
