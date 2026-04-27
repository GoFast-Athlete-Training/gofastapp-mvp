import { prisma } from "@/lib/prisma";
import { parseRaceTimeToSeconds, raceTimeToGoalPaceSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { normalizeDistanceForPace } from "@/lib/pace-utils";
import type { AthleteGoal, athlete_race_results } from "@prisma/client";

export type RaceResultAnalysis = {
  headline: string;
  subText: string;
  prFlag: boolean;
  goalBeatFlag: boolean;
  deltaDisplay: string | null;
};

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
  goal: Pick<AthleteGoal, "goalTime" | "distance">,
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
  goalId: string;
  officialFinishTime: string;
  howFeltRating?: number | null;
  notes?: string | null;
  reflection?: string | null;
};

export type SaveRaceResultExtendedInput = {
  raceRegistryId: string;
  goalId?: string | null;
  signupId?: string | null;
  officialFinishTime?: string | null;
  chipTime?: string | null;
  gunTime?: string | null;
  garminActivityId?: string | null;
  notes?: string | null;
  overallPlace?: number | null;
  ageGroupPlace?: number | null;
  howFeltRating?: number | null;
  reflection?: string | null;
};

/**
 * Full save (LogRaceResultSheet + simple modal): upsert row, goal/PR analysis when a finish time is present.
 */
export async function saveRaceResultExtended(athleteId: string, input: SaveRaceResultExtendedInput) {
  const {
    raceRegistryId,
    goalId: inputGoalId,
    signupId: inputSignupId,
    officialFinishTime,
    chipTime,
    gunTime,
    garminActivityId,
    notes,
    overallPlace,
    ageGroupPlace,
    howFeltRating,
    reflection,
  } = input;

  const reg = await prisma.race_registry.findFirst({
    where: { id: raceRegistryId },
    select: { id: true, name: true, distanceMeters: true, distanceLabel: true, raceDate: true },
  });
  if (!reg) {
    throw new Error("Race not found");
  }

  const goal = inputGoalId
    ? await prisma.athleteGoal.findFirst({
        where: { id: inputGoalId, athleteId },
        include: {
          race_registry: {
            select: { id: true, name: true, distanceMeters: true, distanceLabel: true, raceDate: true },
          },
        },
      })
    : null;

  if (goal && goal.raceRegistryId && goal.raceRegistryId !== raceRegistryId) {
    throw new Error("Goal does not match this race");
  }

  const displayTime =
    (officialFinishTime && String(officialFinishTime).trim()) ||
    (chipTime && String(chipTime).trim()) ||
    (gunTime && String(gunTime).trim()) ||
    "";

  let finishTimeSeconds: number | null = null;
  if (displayTime) {
    try {
      finishTimeSeconds = parseRaceTimeToSeconds(displayTime);
    } catch {
      finishTimeSeconds = null;
    }
  }

  const distKey = goal
    ? normalizeDistanceForPace(
        String(goal.distance ?? ""),
        goal.race_registry?.distanceMeters != null ? Number(goal.race_registry.distanceMeters) : null
      )
    : normalizeDistanceForPace(
        "",
        reg.distanceMeters != null ? Number(reg.distanceMeters) : null
      );
  const distanceLabel = distKey;

  let goalTimeSeconds: number | null = null;
  let goalTimeDeltaSeconds: number | null = null;
  let goalAchieved = false;
  if (goal && finishTimeSeconds != null) {
    goalTimeSeconds = parseOptionalGoalTimeSeconds(goal.goalTime);
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

  const raceDate = goal?.race_registry?.raceDate ?? reg.raceDate ?? goal?.targetByDate;
  const resolvedSignupId =
    inputSignupId ||
    (await prisma.athlete_race_signups.findUnique({
      where: { athleteId_raceRegistryId: { athleteId, raceRegistryId } },
    }))?.id;

  const agPlace =
    ageGroupPlace != null && Number.isFinite(ageGroupPlace) ? Math.floor(ageGroupPlace) : null;
  const data = {
    officialFinishTime: displayTime || null,
    chipTime: chipTime && String(chipTime).trim() ? String(chipTime).trim() : null,
    gunTime: gunTime && String(gunTime).trim() ? String(gunTime).trim() : null,
    finishTimeSeconds,
    goalTimeSeconds: goal && finishTimeSeconds != null ? goalTimeSeconds : null,
    goalTimeDeltaSeconds: goal && finishTimeSeconds != null ? goalTimeDeltaSeconds : null,
    goalAchieved: finishTimeSeconds != null && goal ? goalAchieved : false,
    prAchieved: finishTimeSeconds != null && prAchieved,
    previousPrSeconds:
      finishTimeSeconds != null && prAchieved && previousPrSeconds != null ? previousPrSeconds : null,
    actualAvgPaceSecPerMile: avgPace,
    garminActivityId: garminActivityId && garminActivityId.length > 0 ? garminActivityId : null,
    overallPlace: overallPlace != null && Number.isFinite(overallPlace) ? overallPlace : null,
    ageGroupPlace: agPlace != null && !Number.isNaN(agPlace) ? agPlace : null,
    howFeltRating:
      howFeltRating != null && howFeltRating >= 1 && howFeltRating <= 5 ? howFeltRating : null,
    notes: notes?.trim() || null,
    reflection: reflection?.trim() || null,
    raceDate: raceDate ?? null,
    distanceLabel,
    source: garminActivityId ? "garmin" : "manual",
  };

  const resolvedGoalId = goal?.id ?? null;

  const result = await prisma.athlete_race_results.upsert({
    where: {
      athleteId_raceRegistryId: { athleteId, raceRegistryId },
    },
    create: {
      athleteId,
      raceRegistryId,
      goalId: resolvedGoalId,
      signupId: resolvedSignupId,
      ...data,
    },
    update: {
      ...data,
      goalId: resolvedGoalId,
      signupId: resolvedSignupId ?? undefined,
    },
  });

  if (goal && finishTimeSeconds != null) {
    await prisma.athleteGoal.update({
      where: { id: goal.id },
      data: { status: "COMPLETED", updatedAt: new Date() },
    });
  }

  const analysis =
    goal && finishTimeSeconds != null
      ? analyzeRaceResult(result, goal, goal.race_registry?.name ?? reg.name)
      : null;

  return { result, analysis, goal, raceName: goal?.race_registry?.name ?? reg.name };
}

/**
 * Log finish for a goal (modal): same pipeline as the sheet, keyed by goal.
 */
export async function createRaceResult(athleteId: string, input: CreateRaceResultInput) {
  const g = await prisma.athleteGoal.findFirst({ where: { id: input.goalId, athleteId } });
  if (!g) throw new Error("Goal not found");
  if (!g.raceRegistryId) {
    throw new Error("Link this goal to a race in profile before logging a result");
  }
  if (!String(input.officialFinishTime).trim()) {
    throw new Error("Finish time is required");
  }
  return saveRaceResultExtended(athleteId, {
    raceRegistryId: g.raceRegistryId,
    goalId: input.goalId,
    officialFinishTime: input.officialFinishTime,
    howFeltRating: input.howFeltRating,
    notes: input.notes,
    reflection: input.reflection,
  });
}

export async function getRaceResultByGoalId(athleteId: string, goalId: string) {
  return prisma.athlete_race_results.findFirst({
    where: { athleteId, goalId },
    include: {
      race_registry: { select: { id: true, name: true, distanceLabel: true } },
    },
  });
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
  data: { reflection?: string | null; notes?: string | null; howFeltRating?: number | null }
) {
  const existing = await prisma.athlete_race_results.findFirst({
    where: { id: resultId, athleteId },
  });
  if (!existing) {
    throw new Error("Result not found");
  }
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
    },
  });
}
