/**
 * Athlete races — claimed race snapshots (working set for training).
 * race_registry is origin only; services use athlete_races.id.
 */

import { prisma } from "@/lib/prisma";
import {
  canonicalDistanceLabelFromText,
  metersForCanonicalDistanceLabel,
} from "@/lib/training/race-distance-infer";

const registrySelectForClaim = {
  id: true,
  name: true,
  raceDate: true,
  distanceMeters: true,
  distanceLabel: true,
  city: true,
  state: true,
  slug: true,
  logoUrl: true,
  isActive: true,
  isCancelled: true,
} as const;

export type AthleteRaceRow = {
  id: string;
  athleteId: string;
  raceRegistryId: string;
  name: string;
  raceDate: Date;
  distanceMeters: number | null;
  distanceLabel: string | null;
  city: string | null;
  state: string | null;
  slug: string | null;
  logoUrl: string | null;
  isPrimaryRace: boolean;
  selfDeclaredAt: Date;
  notifyEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SerializedAthleteRace = AthleteRaceRow & {
  race_registry?: {
    id: string;
    slug: string | null;
    logoUrl: string | null;
    country: string | null;
    registrationUrl: string | null;
    startTime: string | null;
    distanceMeters: number | null;
    distanceLabel: string | null;
  } | null;
};

export function snapshotDataFromRegistry(race: {
  name: string;
  raceDate: Date;
  distanceMeters: number | null;
  distanceLabel: string | null;
  city: string | null;
  state: string | null;
  slug: string | null;
  logoUrl: string | null;
}) {
  return {
    name: race.name,
    raceDate: race.raceDate,
    distanceMeters: race.distanceMeters,
    distanceLabel: race.distanceLabel,
    city: race.city,
    state: race.state,
    slug: race.slug,
    logoUrl: race.logoUrl,
  };
}

/** Claim a catalog race → athlete snapshot row (idempotent upsert). */
export async function claimAthleteRace(params: {
  athleteId: string;
  raceRegistryId: string;
}): Promise<SerializedAthleteRace> {
  const race = await prisma.race_registry.findFirst({
    where: {
      id: params.raceRegistryId,
      isActive: true,
      isCancelled: false,
    },
    select: registrySelectForClaim,
  });
  if (!race) {
    throw new Error("Race not found");
  }

  const snapshot = snapshotDataFromRegistry(race);
  const now = new Date();

  const row = await prisma.athlete_races.upsert({
    where: {
      athleteId_raceRegistryId: {
        athleteId: params.athleteId,
        raceRegistryId: params.raceRegistryId,
      },
    },
    create: {
      athleteId: params.athleteId,
      raceRegistryId: params.raceRegistryId,
      ...snapshot,
      updatedAt: now,
    },
    update: {
      updatedAt: now,
    },
    include: {
      race_registry: {
        select: {
          id: true,
          slug: true,
          logoUrl: true,
          country: true,
          registrationUrl: true,
          startTime: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
    },
  });

  return row;
}

export async function listAthleteRaces(athleteId: string): Promise<SerializedAthleteRace[]> {
  return prisma.athlete_races.findMany({
    where: { athleteId },
    include: {
      race_registry: {
        select: {
          id: true,
          slug: true,
          logoUrl: true,
          country: true,
          registrationUrl: true,
          startTime: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
    },
    orderBy: { raceDate: "asc" },
  });
}

export async function getAthleteRaceForAthlete(
  athleteId: string,
  athleteRaceId: string
): Promise<SerializedAthleteRace | null> {
  return prisma.athlete_races.findFirst({
    where: { id: athleteRaceId, athleteId },
    include: {
      race_registry: {
        select: {
          id: true,
          slug: true,
          logoUrl: true,
          country: true,
          registrationUrl: true,
          startTime: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
    },
  });
}

export async function deleteAthleteRace(params: {
  athleteId: string;
  athleteRaceId: string;
}): Promise<boolean> {
  const row = await prisma.athlete_races.findFirst({
    where: { id: params.athleteRaceId, athleteId: params.athleteId },
    select: { id: true },
  });
  if (!row) return false;
  await prisma.athlete_races.delete({ where: { id: row.id } });
  return true;
}

/** Resolve athlete race by registry for an athlete (after claim). */
export async function findAthleteRaceByRegistry(params: {
  athleteId: string;
  raceRegistryId: string;
}) {
  return prisma.athlete_races.findUnique({
    where: {
      athleteId_raceRegistryId: {
        athleteId: params.athleteId,
        raceRegistryId: params.raceRegistryId,
      },
    },
  });
}

/** Athlete sets or corrects working-set race distance (e.g. stub race missing catalog meta). */
export async function updateAthleteRaceDistance(params: {
  athleteId: string;
  athleteRaceId: string;
  distanceLabel: string;
}): Promise<SerializedAthleteRace | null> {
  const canonical = canonicalDistanceLabelFromText(params.distanceLabel);
  if (!canonical) {
    throw new Error("Pick a standard race distance");
  }
  const meters = metersForCanonicalDistanceLabel(canonical);

  const existing = await getAthleteRaceForAthlete(params.athleteId, params.athleteRaceId);
  if (!existing) return null;

  return prisma.athlete_races.update({
    where: { id: existing.id },
    data: {
      distanceLabel: canonical,
      distanceMeters: meters,
      goalDistance: canonical.toLowerCase().replace(/\s+/g, "-"),
      updatedAt: new Date(),
    },
    include: {
      race_registry: {
        select: {
          id: true,
          slug: true,
          logoUrl: true,
          country: true,
          registrationUrl: true,
          startTime: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
    },
  });
}
