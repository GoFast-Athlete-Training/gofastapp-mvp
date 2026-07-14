/**
 * Swim plan preset API parse/serialize — isolated from run training_plan_preset routes.
 */

import { Prisma } from "@prisma/client";
import type { swim_plan_preset } from "@prisma/client";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";
import {
  DEFAULT_MIN_WEEKLY_METERS,
  DEFAULT_SWIM_RECOMMENDATION_MULTIPLIER,
  DEFAULT_TAPER_VOLUME_MULTIPLIER,
  DEFAULT_TAPER_WEEKS,
  normalizeSwimPresetVolume,
  parseSwimWorkoutStructure,
  parseWeeklyProgressionPattern,
} from "@/lib/training/swim-plan-preset";
import {
  parsePresetStrategyFromBody,
  presetStrategyToPrismaJson,
  type PresetStrategyFields,
} from "@/lib/training/preset-strategy";

export type SwimPresetWriteBody = {
  slug?: string | null;
  title?: string;
  description?: string | null;
  publicDescription?: string | null;
  goalSwimDistanceMeters?: number | null;
  recommendationMultiplier?: number | null;
  recommendedWeeklyMeters?: number | null;
  minWeeklyMeters?: number | null;
  maxWeeklyMeters?: number | null;
  cycleLen?: number | null;
  weeklyProgressionPattern?: unknown;
  taperWeeks?: number | null;
  taperVolumeMultiplier?: number | null;
  longSwimShareOfWeek?: number | null;
  longSwimMinMeters?: number | null;
  longSwimMaxMeters?: number | null;
  workoutStructure?: unknown;
  enduranceIdealDow?: number | null;
  thresholdIdealDow?: number | null;
  powerIdealDow?: number | null;
  longSwimIdealDow?: number | null;
  personaId?: string | null;
  goalId?: string | null;
  enduranceConfigId?: string | null;
  thresholdConfigId?: string | null;
  powerConfigId?: string | null;
  longSwimConfigId?: string | null;
} & PresetStrategyFields;

export type SwimPresetApi = ReturnType<typeof serializeSwimPresetForApi>;

function intOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function floatOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function isDow1to7(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 7;
}

export function buildSwimPresetSlug(title: string, override?: string | null): string {
  if (override?.trim()) {
    const s = normalizeSlug(override);
    if (s) return `swim-${s}`;
  }
  const base = normalizeSlug(title) || "preset";
  return `swim-${base}`;
}

export function parseSwimPresetFromBody(
  body: unknown,
  opts?: { requireTitle?: boolean }
): { ok: true; data: SwimPresetWriteBody } | { ok: false; error: string } {
  const requireTitle = opts?.requireTitle !== false;
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const o = body as Record<string, unknown>;
  const titleRaw = typeof o.title === "string" ? o.title.trim() : "";
  if (requireTitle && !titleRaw) {
    return { ok: false, error: "title is required" };
  }

  const strategy = parsePresetStrategyFromBody(o);
  if (!strategy.ok) {
    return { ok: false, error: strategy.error };
  }

  const cycleLen = intOrNull(o.cycleLen);
  if (cycleLen != null && (cycleLen < 1 || cycleLen > 52)) {
    return { ok: false, error: "cycleLen must be between 1 and 52" };
  }

  for (const [key, label] of [
    ["enduranceIdealDow", "enduranceIdealDow"],
    ["thresholdIdealDow", "thresholdIdealDow"],
    ["powerIdealDow", "powerIdealDow"],
    ["longSwimIdealDow", "longSwimIdealDow"],
  ] as const) {
    const dow = intOrNull(o[key]);
    if (dow != null && !isDow1to7(dow)) {
      return { ok: false, error: `${label} must be 1–7 (Mon–Sun)` };
    }
  }

  const workoutStructure = parseSwimWorkoutStructure(o.workoutStructure);
  if (o.workoutStructure != null && !workoutStructure) {
    return { ok: false, error: "workoutStructure must include weeklyCounts" };
  }

  const weeklyProgressionPattern = parseWeeklyProgressionPattern(o.weeklyProgressionPattern);
  if (o.weeklyProgressionPattern != null && !weeklyProgressionPattern) {
    return { ok: false, error: "weeklyProgressionPattern must include weekMultipliers array" };
  }

  return {
    ok: true,
    data: {
      slug: typeof o.slug === "string" ? o.slug : null,
      title: titleRaw || undefined,
      description: typeof o.description === "string" ? o.description : null,
      publicDescription:
        typeof o.publicDescription === "string" ? o.publicDescription : null,
      goalSwimDistanceMeters: intOrNull(o.goalSwimDistanceMeters),
      recommendationMultiplier: floatOrNull(o.recommendationMultiplier),
      recommendedWeeklyMeters: intOrNull(o.recommendedWeeklyMeters),
      minWeeklyMeters: intOrNull(o.minWeeklyMeters),
      maxWeeklyMeters: intOrNull(o.maxWeeklyMeters),
      cycleLen,
      weeklyProgressionPattern: o.weeklyProgressionPattern,
      taperWeeks: intOrNull(o.taperWeeks),
      taperVolumeMultiplier: floatOrNull(o.taperVolumeMultiplier),
      longSwimShareOfWeek: floatOrNull(o.longSwimShareOfWeek),
      longSwimMinMeters: intOrNull(o.longSwimMinMeters),
      longSwimMaxMeters: intOrNull(o.longSwimMaxMeters),
      workoutStructure: o.workoutStructure,
      enduranceIdealDow: intOrNull(o.enduranceIdealDow),
      thresholdIdealDow: intOrNull(o.thresholdIdealDow),
      powerIdealDow: intOrNull(o.powerIdealDow),
      longSwimIdealDow: intOrNull(o.longSwimIdealDow),
      personaId: typeof o.personaId === "string" ? o.personaId : null,
      goalId: typeof o.goalId === "string" ? o.goalId : null,
      enduranceConfigId:
        typeof o.enduranceConfigId === "string" ? o.enduranceConfigId : null,
      thresholdConfigId:
        typeof o.thresholdConfigId === "string" ? o.thresholdConfigId : null,
      powerConfigId: typeof o.powerConfigId === "string" ? o.powerConfigId : null,
      longSwimConfigId:
        typeof o.longSwimConfigId === "string" ? o.longSwimConfigId : null,
      ...strategy.value,
    },
  };
}

export function swimPresetWriteToPrismaCreate(
  parsed: SwimPresetWriteBody
): Prisma.swim_plan_presetCreateInput {
  const volume = normalizeSwimPresetVolume({
    goalSwimDistanceMeters: parsed.goalSwimDistanceMeters,
    recommendationMultiplier:
      parsed.recommendationMultiplier ?? DEFAULT_SWIM_RECOMMENDATION_MULTIPLIER,
    recommendedWeeklyMeters: parsed.recommendedWeeklyMeters,
    minWeeklyMeters: parsed.minWeeklyMeters ?? DEFAULT_MIN_WEEKLY_METERS,
    maxWeeklyMeters: parsed.maxWeeklyMeters,
  });

  const strategyJson = presetStrategyToPrismaJson(parsed);
  const slug = buildSwimPresetSlug(parsed.title ?? "swim-preset", parsed.slug);

  return {
    slug,
    title: parsed.title ?? "Swim preset",
    description: parsed.description ?? undefined,
    publicDescription: parsed.publicDescription ?? undefined,
    goalSwimDistanceMeters: parsed.goalSwimDistanceMeters ?? undefined,
    recommendationMultiplier:
      parsed.recommendationMultiplier ?? DEFAULT_SWIM_RECOMMENDATION_MULTIPLIER,
    recommendedWeeklyMeters: volume.recommendedWeeklyMeters ?? undefined,
    minWeeklyMeters: volume.minWeeklyMeters,
    maxWeeklyMeters: volume.maxWeeklyMeters ?? undefined,
    cycleLen: parsed.cycleLen ?? 4,
    weeklyProgressionPattern:
      parsed.weeklyProgressionPattern != null
        ? (parsed.weeklyProgressionPattern as Prisma.InputJsonValue)
        : undefined,
    taperWeeks: parsed.taperWeeks ?? DEFAULT_TAPER_WEEKS,
    taperVolumeMultiplier:
      parsed.taperVolumeMultiplier ?? DEFAULT_TAPER_VOLUME_MULTIPLIER,
    longSwimShareOfWeek: parsed.longSwimShareOfWeek ?? undefined,
    longSwimMinMeters: parsed.longSwimMinMeters ?? undefined,
    longSwimMaxMeters: parsed.longSwimMaxMeters ?? undefined,
    workoutStructure:
      parsed.workoutStructure != null
        ? (parsed.workoutStructure as Prisma.InputJsonValue)
        : undefined,
    enduranceIdealDow: parsed.enduranceIdealDow ?? 2,
    thresholdIdealDow: parsed.thresholdIdealDow ?? 4,
    powerIdealDow: parsed.powerIdealDow ?? 3,
    longSwimIdealDow: parsed.longSwimIdealDow ?? 6,
    coachIntent: strategyJson.coachIntent,
    objectiveOfPlan: strategyJson.objectiveOfPlan,
    athletePersonaCapability: strategyJson.athletePersonaCapability,
    athletePersonaGoal: strategyJson.athletePersonaGoal,
    athletePersonaDedication: strategyJson.athletePersonaDedication,
    coachPlanOverview: strategyJson.coachPlanOverview,
    paceProfile: strategyJson.paceProfile,
    persona: parsed.personaId ? { connect: { id: parsed.personaId } } : undefined,
    goal: parsed.goalId ? { connect: { id: parsed.goalId } } : undefined,
    enduranceConfig: parsed.enduranceConfigId
      ? { connect: { id: parsed.enduranceConfigId } }
      : undefined,
    thresholdConfig: parsed.thresholdConfigId
      ? { connect: { id: parsed.thresholdConfigId } }
      : undefined,
    powerConfig: parsed.powerConfigId
      ? { connect: { id: parsed.powerConfigId } }
      : undefined,
    longSwimConfig: parsed.longSwimConfigId
      ? { connect: { id: parsed.longSwimConfigId } }
      : undefined,
  };
}

export function serializeSwimPresetForApi<
  T extends swim_plan_preset & { volumeWarnings?: string[] }
>(preset: T) {
  const volume = normalizeSwimPresetVolume({
    goalSwimDistanceMeters: preset.goalSwimDistanceMeters,
    recommendationMultiplier: preset.recommendationMultiplier,
    recommendedWeeklyMeters: preset.recommendedWeeklyMeters,
    minWeeklyMeters: preset.minWeeklyMeters,
    maxWeeklyMeters: preset.maxWeeklyMeters,
  });

  return {
    ...preset,
    sport: "swim" as const,
    recommendedWeeklyMeters: volume.recommendedWeeklyMeters,
    minWeeklyMeters: volume.minWeeklyMeters,
    maxWeeklyMeters: volume.maxWeeklyMeters,
    volumeWarnings: preset.volumeWarnings ?? volume.warnings,
    workoutStructureParsed: parseSwimWorkoutStructure(preset.workoutStructure),
    weeklyProgressionPatternParsed: parseWeeklyProgressionPattern(
      preset.weeklyProgressionPattern
    ),
  };
}

/** Run preset list routes should continue to query training_plan_preset only — never swim_plan_preset. */
export function isRunPresetQuery(sport: unknown): boolean {
  return sport !== "swim";
}
