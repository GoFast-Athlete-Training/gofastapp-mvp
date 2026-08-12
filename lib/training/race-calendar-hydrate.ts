/**
 * Hydrate athlete race calendar with primary goal designation and relative ordering.
 */

import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "@/lib/training/plan-utils";

const raceSelect = {
  id: true,
  slug: true,
  name: true,
  distanceLabel: true,
  distanceMeters: true,
  raceDate: true,
  city: true,
  state: true,
  logoUrl: true,
} as const;

export type HydratedRaceCalendarSignup = {
  signupId: string;
  raceRegistryId: string;
  goalId: string | null;
  /** PRIMARY when this signup matches the active goal race; otherwise OTHER */
  calendarRole: "PRIMARY" | "OTHER";
  /** Position vs primary goal race date */
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
  primaryGoalRaceRegistryId: string | null;
  primaryGoalId: string | null;
  primaryGoalName: string | null;
  primaryGoalTime: string | null;
  signups: HydratedRaceCalendarSignup[];
  /** Upcoming signups before primary goal race (candidate secondary plan events) */
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
  athleteId: string
): Promise<HydratedRaceCalendar> {
  const [activeGoal, signups] = await Promise.all([
    prisma.athleteGoal.findFirst({
      where: { athleteId, status: "ACTIVE" },
      orderBy: { targetByDate: "asc" },
      select: {
        id: true,
        name: true,
        goalTime: true,
        raceRegistryId: true,
        race_registry: { select: raceSelect },
      },
    }),
    prisma.athlete_race_signups.findMany({
      where: { athleteId },
      include: { race_registry: { select: raceSelect } },
      orderBy: { race_registry: { raceDate: "asc" } },
    }),
  ]);

  const primaryRaceId = activeGoal?.raceRegistryId ?? null;
  const primaryDate = activeGoal?.race_registry?.raceDate ?? activeGoal?.targetByDate ?? null;

  const hydrated: HydratedRaceCalendarSignup[] = signups.map((s) => {
    const rr = s.race_registry;
    const calendarRole: HydratedRaceCalendarSignup["calendarRole"] =
      primaryRaceId && s.raceRegistryId === primaryRaceId ? "PRIMARY" : "OTHER";
    return {
      signupId: s.id,
      raceRegistryId: s.raceRegistryId,
      goalId: s.goalId,
      calendarRole,
      positionRelativeToPrimary: positionRelativeToPrimary(rr.raceDate, primaryDate),
      race: {
        id: rr.id,
        slug: rr.slug,
        name: rr.name,
        distanceLabel: rr.distanceLabel,
        distanceMeters: rr.distanceMeters,
        raceDate: rr.raceDate.toISOString(),
        city: rr.city,
        state: rr.state,
        logoUrl: rr.logoUrl,
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

  return {
    primaryGoalRaceRegistryId: primaryRaceId,
    primaryGoalId: activeGoal?.id ?? null,
    primaryGoalName: activeGoal?.name ?? activeGoal?.race_registry?.name ?? null,
    primaryGoalTime: activeGoal?.goalTime ?? null,
    signups: hydrated,
    secondaryCandidates,
  };
}

/** Signups that fall strictly between plan start and primary race (inclusive of race day). */
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
