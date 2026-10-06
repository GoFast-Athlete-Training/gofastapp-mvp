/**
 * When Garmin ingest already stamped a workout for the race name, promote that
 * workout into athlete_race_results (duration from garminDetailActivityId).
 */

import { prisma } from "@/lib/prisma";
import {
  normalizeActivityNameForMatch,
  normalizeGarminMatchText,
  stripTrailingWeekdayMarkerFromTitle,
  stripUpdatedGarminTitlePrefix,
  utcDayRangeFromYmd,
} from "@/lib/training/garmin-activity-match-helpers";
import { ymdFromDate } from "@/lib/training/plan-utils";
import {
  getRaceResultByAthleteRaceId,
  saveRaceResultExtended,
} from "@/lib/race-result-service";

export type MatchedRaceWorkoutSnapshot = {
  workoutId: string;
  title: string;
  garminDetailActivityId: string;
  actualDurationSeconds: number | null;
};

/** Normalize race / workout titles for comparison (not GF W# keyed). */
export function normalizedRaceTitleKey(title: string | null | undefined): string {
  let text = stripUpdatedGarminTitlePrefix(String(title ?? "").trim());
  text = text.replace(/^race\s*[—–-]\s*/i, "").trim();
  text = text.replace(/^(GF\s+)?W\d+\s*:\s*/i, "").trim();
  text = stripTrailingWeekdayMarkerFromTitle(text);
  return normalizeGarminMatchText(text);
}

export function raceTitlesAlign(
  raceName: string | null | undefined,
  workoutTitle: string | null | undefined
): boolean {
  const a = normalizedRaceTitleKey(raceName);
  const b = normalizedRaceTitleKey(workoutTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  // Activity names may still carry location prefix before GF marker; core name match.
  const activityCore = normalizeActivityNameForMatch(workoutTitle);
  return activityCore.length > 0 && normalizeGarminMatchText(activityCore) === a;
}

function raceNameCandidates(params: {
  athleteRaceName: string | null;
  racePlanTitle: string | null;
}): string[] {
  const set = new Set<string>();
  const n = params.athleteRaceName?.trim();
  const p = params.racePlanTitle?.trim();
  if (n) set.add(n);
  if (p) set.add(p);
  return [...set];
}

/**
 * Find a Garmin-linked workout on the athlete race calendar day whose title is the race name.
 */
export async function findMatchedRaceWorkoutForAthleteRace(
  athleteId: string,
  athleteRaceId: string
): Promise<MatchedRaceWorkoutSnapshot | null> {
  const athleteRace = await prisma.athlete_races.findFirst({
    where: { id: athleteRaceId, athleteId },
    select: { id: true, name: true, raceDate: true },
  });
  if (!athleteRace?.raceDate) return null;

  const [racePlan, trainingPlan] = await Promise.all([
    prisma.race_plans.findFirst({
      where: { athleteRaceId, athleteId },
      select: { title: true },
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, athleteRaceId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    }),
  ]);

  const names = raceNameCandidates({
    athleteRaceName: athleteRace.name,
    racePlanTitle: racePlan?.title ?? null,
  });

  const raceYmd = ymdFromDate(athleteRace.raceDate);
  const { start, end } = utcDayRangeFromYmd(raceYmd);

  const workouts = await prisma.workouts.findMany({
    where: {
      athleteId,
      garminDetailActivityId: { not: null },
      date: { gte: start, lt: end },
    },
    select: {
      id: true,
      title: true,
      workoutType: true,
      planId: true,
      garminDetailActivityId: true,
      actualDurationSeconds: true,
      actualDistanceMeters: true,
    },
    orderBy: [{ actualDistanceMeters: "desc" }, { updatedAt: "desc" }],
  });

  let matched = names.length
    ? workouts.filter((w) => names.some((name) => raceTitlesAlign(name, w.title)))
    : [];

  if (matched.length === 0 && trainingPlan?.id) {
    matched = workouts.filter((w) => w.planId === trainingPlan.id);
  }

  if (matched.length === 0) {
    matched = workouts.filter((w) => {
      const core = normalizedRaceTitleKey(w.title);
      return names.some((name) => {
        const nk = normalizedRaceTitleKey(name);
        return nk.length > 4 && (core.includes(nk) || nk.includes(core));
      });
    });
  }

  if (matched.length === 0) return null;

  const pick =
    matched.find((w) => w.workoutType === "Race") ??
    matched.sort(
      (a, b) => (b.actualDistanceMeters ?? 0) - (a.actualDistanceMeters ?? 0)
    )[0];

  if (!pick?.garminDetailActivityId) return null;

  return {
    workoutId: pick.id,
    title: pick.title,
    garminDetailActivityId: pick.garminDetailActivityId,
    actualDurationSeconds: pick.actualDurationSeconds,
  };
}

/**
 * If no result finish time yet, persist from the matched race workout (Garmin duration).
 */
export async function promoteMatchedRaceWorkoutToResultIfNeeded(
  athleteId: string,
  athleteRaceId: string
): Promise<{ promoted: boolean; matchedWorkout: MatchedRaceWorkoutSnapshot | null }> {
  const existing = await getRaceResultByAthleteRaceId(athleteId, athleteRaceId);
  if (existing?.officialFinishTime?.trim()) {
    return { promoted: false, matchedWorkout: null };
  }

  const matched = await findMatchedRaceWorkoutForAthleteRace(athleteId, athleteRaceId);
  if (!matched) {
    return { promoted: false, matchedWorkout: null };
  }

  const athleteRace = await prisma.athlete_races.findFirst({
    where: { id: athleteRaceId, athleteId },
    select: { raceRegistryId: true },
  });
  if (!athleteRace) {
    return { promoted: false, matchedWorkout: matched };
  }

  await saveRaceResultExtended(athleteId, {
    raceRegistryId: athleteRace.raceRegistryId,
    athleteRaceId,
    garminActivityId: matched.garminDetailActivityId,
    officialFinishTime: null,
    chipTime: null,
    gunTime: null,
  });

  return { promoted: true, matchedWorkout: matched };
}

/** After Garmin stamps a workout, persist race result when the workout title is the race name. */
export async function tryPromoteRaceWorkoutAfterGarminStamp(
  athleteId: string,
  workoutId: string
): Promise<void> {
  const workout = await prisma.workouts.findFirst({
    where: { id: workoutId, athleteId },
    select: {
      id: true,
      title: true,
      date: true,
      garminDetailActivityId: true,
    },
  });
  if (!workout?.garminDetailActivityId || !workout.date) return;

  const raceYmd = ymdFromDate(workout.date);
  const { start, end } = utcDayRangeFromYmd(raceYmd);

  const athleteRaces = await prisma.athlete_races.findMany({
    where: {
      athleteId,
      raceDate: { gte: start, lt: end },
    },
    select: { id: true, name: true },
  });

  for (const ar of athleteRaces) {
    try {
      await promoteMatchedRaceWorkoutToResultIfNeeded(athleteId, ar.id);
    } catch (err) {
      console.warn("tryPromoteRaceWorkoutAfterGarminStamp:", err);
    }
  }
}
