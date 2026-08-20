/**
 * Hydrate athlete race calendar from athlete_races snapshots (working set).
 */

import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "@/lib/training/plan-utils";

export type HydratedRaceCalendarSignup = {
  athleteRaceId: string;
  raceRegistryId: string;
  goalId: string | null;
  positionRelativeToPlanRace: "BEFORE" | "ON" | "AFTER" | "UNKNOWN";
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

export type HydratedRaceCalendar = {
  /** ACTIVE plan terminal race FK — defines plan target when set. */
  planAthleteRaceId: string | null;
  primaryGoalId: string | null;
  primaryGoalName: string | null;
  primaryGoalTime: string | null;
  signups: HydratedRaceCalendarSignup[];
  secondaryCandidates: HydratedRaceCalendarSignup[];
};

function positionRelativeToPlanRace(
  raceDate: Date,
  planRaceDate: Date | null
): HydratedRaceCalendarSignup["positionRelativeToPlanRace"] {
  if (!planRaceDate) return "UNKNOWN";
  const a = utcDateOnly(raceDate).getTime();
  const b = utcDateOnly(planRaceDate).getTime();
  if (a < b) return "BEFORE";
  if (a > b) return "AFTER";
  return "ON";
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
      include: {
        athlete_goals: {
          where: { status: "ACTIVE" },
          select: { id: true, goalTime: true, name: true },
          take: 1,
        },
      },
      orderBy: { raceDate: "asc" },
    }),
  ]);

  const planAthleteRaceId = opts?.athleteRaceId ?? activePlan?.athleteRaceId ?? null;
  const planRaceRow = planAthleteRaceId
    ? athleteRaces.find((r) => r.id === planAthleteRaceId)
    : null;
  const planRaceDate = planRaceRow?.raceDate ?? null;

  const hydrated: HydratedRaceCalendarSignup[] = athleteRaces.map((ar) => {
    const goal = ar.athlete_goals[0] ?? null;
    return {
      athleteRaceId: ar.id,
      raceRegistryId: ar.raceRegistryId,
      goalId: goal?.id ?? null,
      positionRelativeToPlanRace: positionRelativeToPlanRace(ar.raceDate, planRaceDate),
      race: {
        id: ar.raceRegistryId,
        slug: ar.slug,
        name: ar.name,
        distanceLabel: ar.distanceLabel,
        distanceMeters: ar.distanceMeters,
        raceDate: ar.raceDate.toISOString(),
        city: ar.city,
        state: ar.state,
        logoUrl: ar.logoUrl,
      },
    };
  });

  const todayMs = utcDateOnly(new Date()).getTime();
  const secondaryCandidates = hydrated.filter(
    (h) =>
      h.positionRelativeToPlanRace === "BEFORE" &&
      utcDateOnly(new Date(h.race.raceDate)).getTime() >= todayMs
  );

  const planGoal = planRaceRow?.athlete_goals[0] ?? null;

  return {
    planAthleteRaceId,
    primaryGoalId: planGoal?.id ?? null,
    primaryGoalName: planGoal?.name ?? planRaceRow?.name ?? null,
    primaryGoalTime: planGoal?.goalTime ?? null,
    signups: hydrated,
    secondaryCandidates,
  };
}

export function filterSignupsInPlanWindow(
  signups: HydratedRaceCalendarSignup[],
  planStart: Date,
  planRaceDate: Date
): HydratedRaceCalendarSignup[] {
  const startMs = utcDateOnly(planStart).getTime();
  const endMs = utcDateOnly(planRaceDate).getTime();
  return signups.filter((s) => {
    const d = utcDateOnly(new Date(s.race.raceDate)).getTime();
    return d >= startMs && d <= endMs;
  });
}
