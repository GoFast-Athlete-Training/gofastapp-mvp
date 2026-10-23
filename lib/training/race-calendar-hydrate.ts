/**
 * Hydrate athlete race calendar from athlete_races snapshots (working set).
 * Goal fields live on each athlete_races row.
 */

import { prisma } from "@/lib/prisma";
import { dateKeyFromDate, dateKeyFromIsoOrDateKey } from "@/lib/calendar-date";
import { productTodayKey, resolveRaceDayKey } from "@/lib/plan-calendar-day";
import { hasGoalOnRace } from "@/lib/goal-race-display";

export type HydratedRaceCalendarAthleteRace = {
  athleteRaceId: string;
  raceRegistryId: string;
  goalTime: string | null;
  goalName: string | null;
  hasGoal: boolean;
  isPrimaryRace: boolean;
  positionRelativeToPlanRace: "BEFORE" | "ON" | "AFTER" | "UNKNOWN";
  isPlanTarget: boolean;
  race: {
    id: string;
    slug: string | null;
    name: string;
    distanceLabel: string | null;
    distanceMeters: number | null;
    raceDate: string;
    city: string | null;
    state: string | null;
    logoUrl: string | null;
  };
};

/** @deprecated Use HydratedRaceCalendarAthleteRace */
export type HydratedRaceCalendarSignup = HydratedRaceCalendarAthleteRace & {
  goalId: string | null;
};

export type HydratedRaceCalendar = {
  /** ACTIVE plan terminal race FK — defines plan target when set. */
  planAthleteRaceId: string | null;
  planRaceName: string | null;
  planRaceGoalTime: string | null;
  athleteRaces: HydratedRaceCalendarAthleteRace[];
  secondaryCandidates: HydratedRaceCalendarAthleteRace[];
  /** @deprecated compatibility — mirrors athleteRaces with goalId alias */
  signups: HydratedRaceCalendarSignup[];
  /** @deprecated compatibility — use planAthleteRaceId when plan race has goal */
  primaryGoalId: string | null;
  /** @deprecated compatibility — use planRaceName */
  primaryGoalName: string | null;
  /** @deprecated compatibility — use planRaceGoalTime */
  primaryGoalTime: string | null;
};

function positionRelativeToPlanRace(
  raceDay: string,
  planRaceDay: string | null
): HydratedRaceCalendarAthleteRace["positionRelativeToPlanRace"] {
  if (!planRaceDay) return "UNKNOWN";
  if (raceDay < planRaceDay) return "BEFORE";
  if (raceDay > planRaceDay) return "AFTER";
  return "ON";
}

export function mapAthleteRaceToCalendarRow(
  ar: {
    id: string;
    raceRegistryId: string;
    name: string;
    raceDate: Date;
    raceDay?: string | null;
    distanceLabel: string | null;
    distanceMeters: number | null;
    city: string | null;
    state: string | null;
    slug: string | null;
    logoUrl: string | null;
    goalTime: string | null;
    goalName: string | null;
    isPrimaryRace?: boolean;
  },
  planRaceDate: Date | null,
  planAthleteRaceId: string | null
): HydratedRaceCalendarAthleteRace {
  const hasGoal = hasGoalOnRace(ar);
  const raceDay = resolveRaceDayKey(ar);
  const planRaceDay = planRaceDate ? resolveRaceDayKey({ raceDate: planRaceDate, raceDay: null }) : null;
  return {
    athleteRaceId: ar.id,
    raceRegistryId: ar.raceRegistryId,
    goalTime: ar.goalTime,
    goalName: ar.goalName,
    hasGoal,
    isPrimaryRace: ar.isPrimaryRace ?? false,
    positionRelativeToPlanRace: positionRelativeToPlanRace(raceDay, planRaceDay),
    isPlanTarget: planAthleteRaceId != null && ar.id === planAthleteRaceId,
    race: {
      id: ar.raceRegistryId,
      slug: ar.slug,
      name: ar.name,
      distanceLabel: ar.distanceLabel,
      distanceMeters: ar.distanceMeters,
      raceDate: raceDay,
      city: ar.city,
      state: ar.state,
      logoUrl: ar.logoUrl,
    },
  };
}

function withSignupCompat(
  row: HydratedRaceCalendarAthleteRace
): HydratedRaceCalendarSignup {
  return {
    ...row,
    goalId: row.hasGoal ? row.athleteRaceId : null,
  };
}

export async function loadHydratedRaceCalendar(
  athleteId: string,
  opts?: { athleteRaceId?: string | null }
): Promise<HydratedRaceCalendar> {
  const [activePlan, athleteRaces] = await Promise.all([
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: { athleteRaceId: true },
    }),
    prisma.athlete_races.findMany({
      where: { athleteId },
      orderBy: { raceDate: "asc" },
    }),
  ]);

  const planAthleteRaceId = opts?.athleteRaceId ?? activePlan?.athleteRaceId ?? null;
  const planRaceRow = planAthleteRaceId
    ? athleteRaces.find((r) => r.id === planAthleteRaceId)
    : null;
  const planRaceDate = planRaceRow?.raceDate ?? null;

  const athleteRaceRows = athleteRaces.map((ar) =>
    mapAthleteRaceToCalendarRow(ar, planRaceDate, planAthleteRaceId)
  );

  const todayKey = productTodayKey();
  const secondaryCandidates = athleteRaceRows.filter(
    (h) =>
      h.positionRelativeToPlanRace === "BEFORE" && h.race.raceDate >= todayKey
  );

  const planHasGoal = planRaceRow != null && hasGoalOnRace(planRaceRow);

  return {
    planAthleteRaceId,
    planRaceName: planRaceRow?.goalName ?? planRaceRow?.name ?? null,
    planRaceGoalTime: planRaceRow?.goalTime ?? null,
    athleteRaces: athleteRaceRows,
    secondaryCandidates,
    signups: athleteRaceRows.map(withSignupCompat),
    primaryGoalId: planHasGoal ? planAthleteRaceId : null,
    primaryGoalName: planRaceRow?.goalName ?? planRaceRow?.name ?? null,
    primaryGoalTime: planRaceRow?.goalTime ?? null,
  };
}

export function filterAthleteRacesInPlanWindow(
  athleteRaces: HydratedRaceCalendarAthleteRace[],
  planStart: Date,
  planRaceDate: Date
): HydratedRaceCalendarAthleteRace[] {
  const startKey = dateKeyFromDate(planStart);
  const endKey = dateKeyFromDate(planRaceDate);
  return athleteRaces.filter((s) => {
    const dKey =
      dateKeyFromIsoOrDateKey(s.race.raceDate) ?? s.race.raceDate.trim().slice(0, 10);
    return dKey >= startKey && dKey <= endKey;
  });
}

/** @deprecated Use filterAthleteRacesInPlanWindow */
export function filterSignupsInPlanWindow(
  signups: HydratedRaceCalendarSignup[],
  planStart: Date,
  planRaceDate: Date
): HydratedRaceCalendarSignup[] {
  return filterAthleteRacesInPlanWindow(signups, planStart, planRaceDate).map(withSignupCompat);
}
