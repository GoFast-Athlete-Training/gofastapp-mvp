/**
 * Hydrate athlete race calendar from athlete_races snapshots (working set).
 */

import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "@/lib/training/plan-utils";

export type HydratedRaceCalendarSignup = {
  athleteRaceId: string;
  /** @deprecated alias for athleteRaceId */
  signupId: string;
  raceRegistryId: string;
  goalId: string | null;
  calendarRole: "PRIMARY" | "OTHER";
  positionRelativeToPrimary: "BEFORE" | "ON" | "AFTER" | "UNKNOWN";
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
  primaryPlanAthleteRaceId: string | null;
  primaryGoalRaceRegistryId: string | null;
  primaryGoalId: string | null;
  primaryGoalName: string | null;
  primaryGoalTime: string | null;
  signups: HydratedRaceCalendarSignup[];
  secondaryCandidates: HydratedRaceCalendarSignup[];
};

function positionRelativeToPrimary(
  raceDate: Date,
  primaryDate: Date | null
): HydratedRaceCalendarSignup["positionRelativeToPrimary"] {
  if (!primaryDate) return "UNKNOWN";
  const a = utcDateOnly(raceDate).getTime();
  const b = utcDateOnly(primaryDate).getTime();
  if (a < b) return "BEFORE";
  if (a > b) return "AFTER";
  return "ON";
}

export async function loadHydratedRaceCalendar(
  athleteId: string,
  opts?: { primaryAthleteRaceId?: string | null }
): Promise<HydratedRaceCalendar> {
  const [activePlan, athleteRaces] = await Promise.all([
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: { primaryAthleteRaceId: true },
    }),
    prisma.athlete_races.findMany({
      where: { athleteId },
      include: {
        race_registry: {
          select: {
            id: true,
            slug: true,
            logoUrl: true,
          },
        },
        athlete_goals: {
          where: { status: "ACTIVE" },
          select: { id: true, goalTime: true, name: true },
          take: 1,
        },
      },
      orderBy: { raceDate: "asc" },
    }),
  ]);

  const primaryAthleteRaceId =
    opts?.primaryAthleteRaceId ?? activePlan?.primaryAthleteRaceId ?? null;
  const primaryRow = primaryAthleteRaceId
    ? athleteRaces.find((r) => r.id === primaryAthleteRaceId)
    : null;
  const primaryDate = primaryRow?.raceDate ?? null;
  const primaryRegistryId = primaryRow?.raceRegistryId ?? null;

  const hydrated: HydratedRaceCalendarSignup[] = athleteRaces.map((ar) => {
    const goal = ar.athlete_goals[0] ?? null;
    const calendarRole: HydratedRaceCalendarSignup["calendarRole"] =
      primaryAthleteRaceId && ar.id === primaryAthleteRaceId
        ? "PRIMARY"
        : primaryRegistryId && ar.raceRegistryId === primaryRegistryId
          ? "PRIMARY"
          : "OTHER";
    return {
      athleteRaceId: ar.id,
      signupId: ar.id,
      raceRegistryId: ar.raceRegistryId,
      goalId: goal?.id ?? null,
      calendarRole,
      positionRelativeToPrimary: positionRelativeToPrimary(ar.raceDate, primaryDate),
      race: {
        id: ar.raceRegistryId,
        slug: ar.race_registry.slug,
        name: ar.name,
        distanceLabel: ar.distanceLabel,
        distanceMeters: ar.distanceMeters,
        raceDate: ar.raceDate.toISOString(),
        city: ar.city,
        state: ar.state,
        logoUrl: ar.race_registry.logoUrl,
      },
    };
  });

  const todayMs = utcDateOnly(new Date()).getTime();
  const secondaryCandidates = hydrated.filter(
    (h) =>
      h.calendarRole === "OTHER" &&
      h.positionRelativeToPrimary === "BEFORE" &&
      utcDateOnly(new Date(h.race.raceDate)).getTime() >= todayMs
  );

  const primaryGoal = primaryRow?.athlete_goals[0] ?? null;

  return {
    primaryPlanAthleteRaceId: primaryAthleteRaceId,
    primaryGoalRaceRegistryId: primaryRegistryId,
    primaryGoalId: primaryGoal?.id ?? null,
    primaryGoalName: primaryGoal?.name ?? primaryRow?.name ?? null,
    primaryGoalTime: primaryGoal?.goalTime ?? null,
    signups: hydrated,
    secondaryCandidates,
  };
}

export function filterSignupsInPlanWindow(
  signups: HydratedRaceCalendarSignup[],
  planStart: Date,
  primaryRaceDate: Date
): HydratedRaceCalendarSignup[] {
  const startMs = utcDateOnly(planStart).getTime();
  const endMs = utcDateOnly(primaryRaceDate).getTime();
  return signups.filter((s) => {
    const d = utcDateOnly(new Date(s.race.raceDate)).getTime();
    return d >= startMs && d <= endMs;
  });
}
