import { prisma } from "@/lib/prisma";
import { parseRaceTimeToSeconds, raceTimeToGoalPaceSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { normalizeDistanceForPace } from "@/lib/pace-utils";
import type { athlete_race_results } from "@prisma/client";
import { athleteRaceGoalSelect, type AthleteRaceGoalRow } from "@/lib/athlete-race-goal";

export type RaceResultAnalysis = {
  headline: string;
  subText: string;
  prFlag: boolean;
  goalBeatFlag: boolean;
  deltaDisplay: string | null;
};

type GoalSnapshot = Pick<AthleteRaceGoalRow, "goalTime" | "goalDistance" | "distanceMeters" | "distanceLabel" | "name" | "raceDate">;

/** Format total seconds to H:MM:SS or M:SS */
export function formatSecondsAsRaceTime(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "—";
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function parseOptionalGoalTimeSeconds(goalTime: string | null | undefined): number | null {
  if (goalTime == null || !String(goalTime).trim()) return null;
  try {
    return parseRaceTimeToSeconds(String(goalTime).trim());
  } catch {
    return null;
  }
}

/**
 * After logging a result: narrative for modal / home card.
 */
export function analyzeRaceResult(
  result: Pick<
    athlete_race_results,
    "finishTimeSeconds" | "goalTimeSeconds" | "goalAchieved" | "prAchieved" | "officialFinishTime"
  >,
  goal: Pick<GoalSnapshot, "goalTime" | "goalDistance">,
  raceName: string
): RaceResultAnalysis {
  const finishSec = result.finishTimeSeconds;
  const finishStr = result.officialFinishTime ?? (finishSec != null ? formatSecondsAsRaceTime(finishSec) : "—");
  const goalStr = goal.goalTime?.trim() ? goal.goalTime.trim() : null;

  if (result.prAchieved) {
    return {
      headline: "New PR in the books",
      subText: `${raceName} — ${finishStr}. Stellar run.`,
      prFlag: true,
      goalBeatFlag: result.goalAchieved,
      deltaDisplay: null,
    };
  }

  if (result.goalAchieved && goalStr) {
    return {
      headline: "You predicted it",
      subText: `Goal was ${goalStr}. You ran ${finishStr}. That’s the work paying off.`,
      prFlag: false,
      goalBeatFlag: true,
      deltaDisplay: null,
    };
  }

  if (!result.goalAchieved && result.goalTimeSeconds != null && finishSec != null) {
    const delta = finishSec - result.goalTimeSeconds;
    const abs = Math.abs(delta);
    return {
      headline: "Race day, logged",
      subText: `You were ${formatSecondsAsRaceTime(abs)} ${
        delta > 0 ? "slower than" : "faster than"
      } your A goal. No PR — let’s look at your training and line up the next one.`,
      prFlag: false,
      goalBeatFlag: false,
      deltaDisplay: formatSecondsAsRaceTime(abs),
    };
  }

  if (!goalStr) {
    return {
      headline: "Nice work",
      subText: `${finishStr} at ${raceName} — in the books.`,
      prFlag: false,
      goalBeatFlag: false,
      deltaDisplay: null,
    };
  }

  return {
    headline: "Race in the books",
    subText: `Goal: ${goalStr} · You: ${finishStr}`,
    prFlag: false,
    goalBeatFlag: result.goalAchieved,
    deltaDisplay: null,
  };
}

export type CreateRaceResultInput = {
  /** athlete_races.id */
  athleteRaceId: string;
  officialFinishTime: string;
  howFeltRating?: number | null;
  notes?: string | null;
  reflection?: string | null;
  racePhotoUrls?: unknown;
};

export type SaveRaceResultExtendedInput = {
  raceRegistryId: string;
  /** athlete_races.id */
  athleteRaceId?: string | null;
  /** @deprecated alias for athleteRaceId */
  signupId?: string | null;
  /** @deprecated alias — same as athleteRaceId after goal cutover */
  goalId?: string | null;
  officialFinishTime?: string | null;
  chipTime?: string | null;
  gunTime?: string | null;
  garminActivityId?: string | null;
  notes?: string | null;
  overallPlace?: number | null;
  ageGroupPlace?: number | null;
  howFeltRating?: number | null;
  reflection?: string | null;
  racePhotoUrls?: string[] | null;
};

/** Normalize photo URL list from API input; undefined = leave unchanged in partial updates. */
export function normalizeRacePhotoUrls(input: unknown): string[] | undefined {
  if (input === undefined) return undefined;
  if (input === null) return [];
  if (!Array.isArray(input)) return [];
  return input
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .map((s) => s.trim());
}

function trimOrNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

async function loadAthleteRaceGoal(
  athleteId: string,
  athleteRaceId: string | null | undefined
): Promise<AthleteRaceGoalRow | null> {
  if (!athleteRaceId?.trim()) return null;
  return prisma.athlete_races.findFirst({
    where: { id: athleteRaceId.trim(), athleteId },
    select: athleteRaceGoalSelect,
  });
}

/**
 * Full save (LogRaceResultSheet + simple modal): upsert row, goal/PR analysis when a finish time is present.
 */
export async function saveRaceResultExtended(athleteId: string, input: SaveRaceResultExtendedInput) {
  const {
    raceRegistryId,
    goalId: inputGoalIdLegacy,
    signupId: inputSignupIdLegacy,
    athleteRaceId: inputAthleteRaceId,
    officialFinishTime,
    chipTime,
    gunTime,
    garminActivityId,
    notes,
    overallPlace,
    ageGroupPlace,
    howFeltRating,
    reflection,
    racePhotoUrls: inputRacePhotoUrls,
  } = input;

  const resolvedAthleteRaceIdInput =
    inputAthleteRaceId ?? inputSignupIdLegacy ?? inputGoalIdLegacy ?? null;

  const racePhotoUrls = normalizeRacePhotoUrls(inputRacePhotoUrls);

  const existingRow = await prisma.athlete_race_results.findUnique({
    where: { athleteId_raceRegistryId: { athleteId, raceRegistryId } },
    select: {
      chipTime: true,
      gunTime: true,
      garminActivityId: true,
      notes: true,
      overallPlace: true,
      ageGroupPlace: true,
      howFeltRating: true,
      reflection: true,
      racePhotoUrls: true,
    },
  });

  const mergedGarminId =
    garminActivityId !== undefined
      ? trimOrNull(garminActivityId)
      : existingRow?.garminActivityId ?? null;

  const chipEffective =
    chipTime !== undefined ? trimOrNull(chipTime) : existingRow?.chipTime ?? null;
  const gunEffective = gunTime !== undefined ? trimOrNull(gunTime) : existingRow?.gunTime ?? null;

  const reg = await prisma.race_registry.findFirst({
    where: { id: raceRegistryId },
    select: { id: true, name: true, distanceMeters: true, distanceLabel: true, raceDate: true },
  });
  if (!reg) {
    throw new Error("Race not found");
  }

  const athleteRace = await loadAthleteRaceGoal(athleteId, resolvedAthleteRaceIdInput);

  if (athleteRace?.raceRegistryId && athleteRace.raceRegistryId !== raceRegistryId) {
    throw new Error("Race signup does not match this race");
  }

  let displayTime =
    trimOrNull(officialFinishTime) || chipEffective || gunEffective || "";

  let timeDerivedFromGarminActivity = false;
  if (!displayTime && mergedGarminId) {
    const activity = await prisma.athlete_activities.findFirst({
      where: { id: mergedGarminId, athleteId },
      select: { id: true, duration: true },
    });
    if (!activity) {
      throw new Error("Activity not found or does not belong to you");
    }
    if (activity.duration == null || activity.duration <= 0) {
      throw new Error("This activity has no duration; enter a finish time instead");
    }
    displayTime = formatSecondsAsRaceTime(activity.duration);
    timeDerivedFromGarminActivity = true;
  }

  if (!displayTime) {
    throw new Error("Enter a finish time or link this result to a synced activity with duration");
  }

  const typedTimeEntered = Boolean(
    trimOrNull(officialFinishTime) || chipEffective || gunEffective
  );

  const finishTimeSeconds = parseRaceTimeToSeconds(displayTime);

  const distKey = athleteRace
    ? normalizeDistanceForPace(
        String(athleteRace.goalDistance ?? ""),
        athleteRace.distanceMeters != null ? Number(athleteRace.distanceMeters) : null
      )
    : normalizeDistanceForPace("", reg.distanceMeters != null ? Number(reg.distanceMeters) : null);
  const distanceLabel = distKey;

  let goalTimeSeconds: number | null = null;
  let goalTimeDeltaSeconds: number | null = null;
  let goalAchieved = false;
  if (athleteRace && finishTimeSeconds != null) {
    goalTimeSeconds = parseOptionalGoalTimeSeconds(athleteRace.goalTime);
    if (goalTimeSeconds != null) {
      goalTimeDeltaSeconds = finishTimeSeconds - goalTimeSeconds;
      goalAchieved = finishTimeSeconds <= goalTimeSeconds;
    }
  }

  let avgPace: number | null = null;
  if (finishTimeSeconds != null) {
    try {
      avgPace = raceTimeToGoalPaceSecondsPerMile(finishTimeSeconds, distKey);
    } catch {
      avgPace = null;
    }
  }

  let previousPrSeconds: number | null = null;
  let prAchieved = false;
  if (finishTimeSeconds != null) {
    const otherAtDistance = await prisma.athlete_race_results.findMany({
      where: {
        athleteId,
        finishTimeSeconds: { not: null },
        distanceLabel,
        raceRegistryId: { not: raceRegistryId },
      },
      select: { finishTimeSeconds: true },
    });
    if (otherAtDistance.length === 0) {
      prAchieved = true;
    } else {
      const best = Math.min(...otherAtDistance.map((r) => r.finishTimeSeconds!));
      previousPrSeconds = best;
      prAchieved = finishTimeSeconds < best;
    }
  }

  const raceDate = athleteRace?.raceDate ?? reg.raceDate ?? null;
  const resolvedAthleteRaceId =
    resolvedAthleteRaceIdInput ||
    (
      await prisma.athlete_races.findUnique({
        where: { athleteId_raceRegistryId: { athleteId, raceRegistryId } },
      })
    )?.id;

  const agPlace =
    ageGroupPlace != null && Number.isFinite(ageGroupPlace) ? Math.floor(ageGroupPlace) : null;

  const notesEffective = notes !== undefined ? trimOrNull(notes) : existingRow?.notes ?? null;
  const overallEffective =
    overallPlace !== undefined
      ? overallPlace != null && Number.isFinite(overallPlace)
        ? overallPlace
        : null
      : existingRow?.overallPlace ?? null;
  const ageGroupEffective =
    ageGroupPlace !== undefined
      ? agPlace != null && !Number.isNaN(agPlace)
        ? agPlace
        : null
      : existingRow?.ageGroupPlace ?? null;
  const howFeltEffective =
    howFeltRating !== undefined
      ? howFeltRating != null && howFeltRating >= 1 && howFeltRating <= 5
        ? howFeltRating
        : null
      : existingRow?.howFeltRating ?? null;
  const reflectionEffective =
    reflection !== undefined ? trimOrNull(reflection) : existingRow?.reflection ?? null;

  const racePhotoUrlsEffective =
    racePhotoUrls !== undefined ? racePhotoUrls : (existingRow?.racePhotoUrls ?? []);

  const source =
    timeDerivedFromGarminActivity && !typedTimeEntered && mergedGarminId ? "garmin" : "manual";

  const data = {
    officialFinishTime: displayTime,
    chipTime: chipEffective,
    gunTime: gunEffective,
    finishTimeSeconds,
    goalTimeSeconds: athleteRace && finishTimeSeconds != null ? goalTimeSeconds : null,
    goalTimeDeltaSeconds: athleteRace && finishTimeSeconds != null ? goalTimeDeltaSeconds : null,
    goalAchieved: finishTimeSeconds != null && athleteRace ? goalAchieved : false,
    prAchieved: finishTimeSeconds != null && prAchieved,
    previousPrSeconds:
      finishTimeSeconds != null && prAchieved && previousPrSeconds != null ? previousPrSeconds : null,
    actualAvgPaceSecPerMile: avgPace,
    garminActivityId: mergedGarminId,
    overallPlace: overallEffective,
    ageGroupPlace: ageGroupEffective,
    howFeltRating: howFeltEffective,
    notes: notesEffective,
    reflection: reflectionEffective,
    racePhotoUrls: racePhotoUrlsEffective,
    raceDate: raceDate ?? null,
    distanceLabel,
    source,
  };

  const result = await prisma.athlete_race_results.upsert({
    where: {
      athleteId_raceRegistryId: { athleteId, raceRegistryId },
    },
    create: {
      athleteId,
      raceRegistryId,
      athleteRaceId: resolvedAthleteRaceId,
      ...data,
    },
    update: {
      ...data,
      athleteRaceId: resolvedAthleteRaceId ?? undefined,
    },
  });

  const analysis =
    athleteRace && finishTimeSeconds != null
      ? analyzeRaceResult(result, athleteRace, athleteRace.name ?? reg.name)
      : null;

  return {
    result,
    analysis,
    athleteRace,
    raceName: athleteRace?.name ?? reg.name,
  };
}

/**
 * Log finish for a race row (modal): same pipeline as the sheet, keyed by athleteRaceId.
 */
export async function createRaceResult(athleteId: string, input: CreateRaceResultInput) {
  const athleteRace = await loadAthleteRaceGoal(athleteId, input.athleteRaceId);
  if (!athleteRace) throw new Error("Race not found");
  if (!String(input.officialFinishTime).trim()) {
    throw new Error("Finish time is required");
  }
  const t = String(input.officialFinishTime).trim();
  try {
    parseRaceTimeToSeconds(t);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid finish time format";
    throw new Error(msg);
  }
  return saveRaceResultExtended(athleteId, {
    raceRegistryId: athleteRace.raceRegistryId,
    athleteRaceId: input.athleteRaceId,
    officialFinishTime: input.officialFinishTime,
    chipTime: null,
    gunTime: null,
    howFeltRating: input.howFeltRating,
    notes: input.notes,
    reflection: input.reflection,
    racePhotoUrls: normalizeRacePhotoUrls(input.racePhotoUrls),
  });
}

export async function getRaceResultByAthleteRaceId(athleteId: string, athleteRaceId: string) {
  return prisma.athlete_race_results.findFirst({
    where: { athleteId, athleteRaceId },
    include: {
      race_registry: { select: { id: true, name: true, distanceLabel: true } },
    },
  });
}

/** @deprecated goalId === athleteRaceId after cutover */
export async function getRaceResultByGoalId(athleteId: string, goalId: string) {
  return getRaceResultByAthleteRaceId(athleteId, goalId);
}

export async function listRaceResultsByRegistry(athleteId: string, raceRegistryId: string) {
  return prisma.athlete_race_results.findMany({
    where: { athleteId, raceRegistryId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateRaceResultReflection(
  athleteId: string,
  resultId: string,
  data: {
    reflection?: string | null;
    notes?: string | null;
    howFeltRating?: number | null;
    racePhotoUrls?: string[] | null;
  }
) {
  const existing = await prisma.athlete_race_results.findFirst({
    where: { id: resultId, athleteId },
  });
  if (!existing) {
    throw new Error("Result not found");
  }
  const photoList =
    data.racePhotoUrls !== undefined ? normalizeRacePhotoUrls(data.racePhotoUrls ?? []) : undefined;
  return prisma.athlete_race_results.update({
    where: { id: resultId },
    data: {
      reflection: data.reflection !== undefined ? data.reflection?.trim() || null : undefined,
      notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
      howFeltRating:
        data.howFeltRating !== undefined
          ? data.howFeltRating != null && data.howFeltRating >= 1 && data.howFeltRating <= 5
            ? data.howFeltRating
            : null
          : undefined,
      racePhotoUrls: photoList !== undefined ? photoList : undefined,
    },
  });
}

/** Update time, activity link, and optional fields for an existing result row. */
export async function updateRaceResultById(
  athleteId: string,
  resultId: string,
  patch: Partial<SaveRaceResultExtendedInput>
) {
  const row = await prisma.athlete_race_results.findFirst({
    where: { id: resultId, athleteId },
  });
  if (!row) {
    throw new Error("Result not found");
  }
  return saveRaceResultExtended(athleteId, {
    raceRegistryId: patch.raceRegistryId ?? row.raceRegistryId,
    athleteRaceId:
      patch.athleteRaceId !== undefined
        ? patch.athleteRaceId
        : patch.signupId !== undefined
          ? patch.signupId
          : patch.goalId !== undefined
            ? patch.goalId
            : row.athleteRaceId,
    officialFinishTime: patch.officialFinishTime !== undefined ? patch.officialFinishTime : row.officialFinishTime,
    chipTime: patch.chipTime !== undefined ? patch.chipTime : row.chipTime,
    gunTime: patch.gunTime !== undefined ? patch.gunTime : row.gunTime,
    garminActivityId: patch.garminActivityId !== undefined ? patch.garminActivityId : row.garminActivityId,
    notes: patch.notes !== undefined ? patch.notes : row.notes,
    overallPlace: patch.overallPlace !== undefined ? patch.overallPlace : row.overallPlace,
    ageGroupPlace: patch.ageGroupPlace !== undefined ? patch.ageGroupPlace : row.ageGroupPlace,
    howFeltRating: patch.howFeltRating !== undefined ? patch.howFeltRating : row.howFeltRating,
    reflection: patch.reflection !== undefined ? patch.reflection : row.reflection,
    racePhotoUrls: patch.racePhotoUrls !== undefined ? patch.racePhotoUrls : row.racePhotoUrls,
  });
}
