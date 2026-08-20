/**
 * Plan-level race snapshots — frozen copies of athlete_races at create / reassignment / generation.
 */

import { Prisma } from "@prisma/client";
import { utcDateOnly } from "@/lib/training/plan-utils";

export type AthleteRacePlanSnap = {
  sourceAthleteRaceId: string;
  raceRegistryId: string;
  name: string;
  raceDate: string;
  distanceMeters: number | null;
  distanceLabel: string | null;
  city: string | null;
  state: string | null;
};

export type AthleteRaceSnapSource = {
  id: string;
  raceRegistryId: string;
  name: string;
  raceDate: Date;
  distanceMeters: number | null;
  distanceLabel: string | null;
  city?: string | null;
  state?: string | null;
};

export function athleteRaceRowToPlanSnap(row: AthleteRaceSnapSource): AthleteRacePlanSnap {
  return {
    sourceAthleteRaceId: row.id,
    raceRegistryId: row.raceRegistryId,
    name: row.name,
    raceDate: row.raceDate.toISOString(),
    distanceMeters: row.distanceMeters,
    distanceLabel: row.distanceLabel,
    city: row.city,
    state: row.state,
  };
}

export function parseAthleteRaceMainSnap(json: unknown): AthleteRacePlanSnap | null {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  if (typeof o.sourceAthleteRaceId !== "string" || typeof o.raceRegistryId !== "string") {
    return null;
  }
  if (typeof o.name !== "string" || typeof o.raceDate !== "string") return null;
  return {
    sourceAthleteRaceId: o.sourceAthleteRaceId,
    raceRegistryId: o.raceRegistryId,
    name: o.name,
    raceDate: o.raceDate,
    distanceMeters:
      typeof o.distanceMeters === "number" && Number.isFinite(o.distanceMeters)
        ? o.distanceMeters
        : null,
    distanceLabel: typeof o.distanceLabel === "string" ? o.distanceLabel : null,
    city: typeof o.city === "string" ? o.city : null,
    state: typeof o.state === "string" ? o.state : null,
  };
}

export function parseAthleteRaceAlongWaySnaps(json: unknown): AthleteRacePlanSnap[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((item) => parseAthleteRaceMainSnap(item))
    .filter((snap): snap is AthleteRacePlanSnap => snap != null);
}

/** Build along-way snapshots from athlete races in [planStart, terminalRaceDate]. */
export function buildAlongWaySnaps(params: {
  planStart: Date;
  terminalRaceDate: Date;
  terminalAthleteRaceId: string;
  allAthleteRaces: AthleteRaceSnapSource[];
  includedAlongWayIds?: Set<string> | null;
}): AthleteRacePlanSnap[] {
  const startMs = utcDateOnly(params.planStart).getTime();
  const endMs = utcDateOnly(params.terminalRaceDate).getTime();
  const includedSet = params.includedAlongWayIds ?? null;

  const rows = params.allAthleteRaces
    .filter((row) => {
      if (row.id === params.terminalAthleteRaceId) return false;
      const dMs = utcDateOnly(row.raceDate).getTime();
      if (dMs < startMs || dMs > endMs) return false;
      if (includedSet != null && !includedSet.has(row.id)) return false;
      return true;
    })
    .sort((a, b) => a.raceDate.getTime() - b.raceDate.getTime());

  return rows.map(athleteRaceRowToPlanSnap);
}

export function buildPlanRaceSnapshots(params: {
  mainRow: AthleteRaceSnapSource;
  planStart: Date;
  allAthleteRaces: AthleteRaceSnapSource[];
  includedAlongWayIds?: Set<string> | null;
}): {
  athleteRaceMainSnap: AthleteRacePlanSnap;
  athleteRaceAlongWaySnaps: AthleteRacePlanSnap[];
} {
  const athleteRaceMainSnap = athleteRaceRowToPlanSnap(params.mainRow);
  const athleteRaceAlongWaySnaps = buildAlongWaySnaps({
    planStart: params.planStart,
    terminalRaceDate: params.mainRow.raceDate,
    terminalAthleteRaceId: params.mainRow.id,
    allAthleteRaces: params.allAthleteRaces,
    includedAlongWayIds: params.includedAlongWayIds,
  });
  return { athleteRaceMainSnap, athleteRaceAlongWaySnaps };
}

export function planRaceSnapshotsToPrismaJson(snapshots: {
  athleteRaceMainSnap: AthleteRacePlanSnap;
  athleteRaceAlongWaySnaps: AthleteRacePlanSnap[];
}): {
  athleteRaceMainSnap: Prisma.InputJsonValue;
  athleteRaceAlongWaySnaps: Prisma.InputJsonValue;
} {
  return {
    athleteRaceMainSnap: snapshots.athleteRaceMainSnap as unknown as Prisma.InputJsonValue,
    athleteRaceAlongWaySnaps:
      snapshots.athleteRaceAlongWaySnaps as unknown as Prisma.InputJsonValue,
  };
}

export function mainSnapToCalendarEntry(
  snap: AthleteRacePlanSnap
): Pick<
  import("@/lib/training/race-plan-calendar-service").PlanRaceCalendarEntry,
  | "athleteRaceId"
  | "raceRegistryId"
  | "raceName"
  | "raceDate"
  | "distanceMeters"
  | "distanceLabel"
  | "role"
  | "inclusion"
> {
  return {
    athleteRaceId: snap.sourceAthleteRaceId,
    raceRegistryId: snap.raceRegistryId,
    raceName: snap.name,
    raceDate: new Date(snap.raceDate),
    distanceMeters: snap.distanceMeters,
    distanceLabel: snap.distanceLabel,
    role: "PRIMARY",
    inclusion: "INCLUDED",
  };
}

export function resolvePlanTerminalRaceDisplay(plan: {
  athleteRaceId?: string | null;
  athlete_race?: AthleteRaceSnapSource | null;
  athleteRaceMainSnap?: unknown;
  race_registry?: {
    id: string;
    name: string;
    raceDate: Date;
    distanceMeters: number | null;
    distanceLabel: string | null;
  } | null;
}): {
  athleteRaceId: string | null;
  raceRegistryId: string | null;
  name: string;
  raceDate: Date;
  distanceMeters: number | null;
  distanceLabel: string | null;
} | null {
  if (plan.athlete_race) {
    return {
      athleteRaceId: plan.athlete_race.id,
      raceRegistryId: plan.athlete_race.raceRegistryId,
      name: plan.athlete_race.name,
      raceDate: plan.athlete_race.raceDate,
      distanceMeters: plan.athlete_race.distanceMeters,
      distanceLabel: plan.athlete_race.distanceLabel,
    };
  }
  const mainSnap = parseAthleteRaceMainSnap(plan.athleteRaceMainSnap);
  if (mainSnap) {
    return {
      athleteRaceId: mainSnap.sourceAthleteRaceId,
      raceRegistryId: mainSnap.raceRegistryId,
      name: mainSnap.name,
      raceDate: new Date(mainSnap.raceDate),
      distanceMeters: mainSnap.distanceMeters,
      distanceLabel: mainSnap.distanceLabel,
    };
  }
  if (plan.race_registry) {
    return {
      athleteRaceId: plan.athleteRaceId ?? null,
      raceRegistryId: plan.race_registry.id,
      name: plan.race_registry.name,
      raceDate: plan.race_registry.raceDate,
      distanceMeters: plan.race_registry.distanceMeters,
      distanceLabel: plan.race_registry.distanceLabel,
    };
  }
  return null;
}

export function alongWaySnapToCalendarEntry(
  snap: AthleteRacePlanSnap
): Pick<
  import("@/lib/training/race-plan-calendar-service").PlanRaceCalendarEntry,
  | "athleteRaceId"
  | "raceRegistryId"
  | "raceName"
  | "raceDate"
  | "distanceMeters"
  | "distanceLabel"
  | "role"
  | "inclusion"
> {
  return {
    athleteRaceId: snap.sourceAthleteRaceId,
    raceRegistryId: snap.raceRegistryId,
    raceName: snap.name,
    raceDate: new Date(snap.raceDate),
    distanceMeters: snap.distanceMeters,
    distanceLabel: snap.distanceLabel,
    role: "SECONDARY",
    inclusion: "INCLUDED",
  };
}
