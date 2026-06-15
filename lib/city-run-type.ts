export const CITY_RUN_TYPES = [
  'CLUB',
  'INDIVIDUAL',
  'RACE_SHAKEOUT',
  'RUN_CREW',
  'OTHER',
] as const;

export type CityRunTypeValue = (typeof CITY_RUN_TYPES)[number];

export type CityRunRelationshipSnapshot = {
  runClubId?: string | null;
  runCrewId?: string | null;
  athleteGeneratedId?: string | null;
  shakeoutDedupeKey?: string | null;
  raceRegistryId?: string | null;
};

export function resolveCityRunType(opts: CityRunRelationshipSnapshot): CityRunTypeValue {
  if (opts.runClubId) return 'CLUB';
  if (opts.shakeoutDedupeKey || opts.raceRegistryId) return 'RACE_SHAKEOUT';
  if (opts.runCrewId) return 'RUN_CREW';
  if (opts.athleteGeneratedId) return 'INDIVIDUAL';
  return 'OTHER';
}

/** Merge existing relationship FKs with optional PATCH body fields. */
export function mergeRelationshipSnapshot(
  existing: CityRunRelationshipSnapshot,
  patch: Partial<CityRunRelationshipSnapshot>
): CityRunRelationshipSnapshot {
  return {
    runClubId: patch.runClubId !== undefined ? patch.runClubId : existing.runClubId,
    runCrewId: patch.runCrewId !== undefined ? patch.runCrewId : existing.runCrewId,
    athleteGeneratedId:
      patch.athleteGeneratedId !== undefined
        ? patch.athleteGeneratedId
        : existing.athleteGeneratedId,
    shakeoutDedupeKey:
      patch.shakeoutDedupeKey !== undefined
        ? patch.shakeoutDedupeKey
        : existing.shakeoutDedupeKey,
    raceRegistryId:
      patch.raceRegistryId !== undefined ? patch.raceRegistryId : existing.raceRegistryId,
  };
}

/** Resolve enum from final persisted relationship state after a mutation. */
export function cityRunTypeFromSnapshot(snapshot: CityRunRelationshipSnapshot): CityRunTypeValue {
  return resolveCityRunType(snapshot);
}

const RELATIONSHIP_KEYS: (keyof CityRunRelationshipSnapshot)[] = [
  'runClubId',
  'runCrewId',
  'athleteGeneratedId',
  'shakeoutDedupeKey',
  'raceRegistryId',
];

export function relationshipPatchFromBody(
  body: Record<string, unknown>
): Partial<CityRunRelationshipSnapshot> {
  const patch: Partial<CityRunRelationshipSnapshot> = {};
  for (const key of RELATIONSHIP_KEYS) {
    if (body[key] !== undefined) {
      const raw = body[key];
      patch[key] =
        raw === null || raw === ''
          ? null
          : typeof raw === 'string'
            ? raw.trim() || null
            : (raw as string | null);
    }
  }
  return patch;
}

export function hasRelationshipPatch(patch: Partial<CityRunRelationshipSnapshot>): boolean {
  return RELATIONSHIP_KEYS.some((k) => patch[k] !== undefined);
}

export function isClubRun(run: {
  cityRunType?: string | null;
  runClubId?: string | null;
  runClub?: { name?: string } | null;
}): boolean {
  if (run.cityRunType) return run.cityRunType === 'CLUB';
  return Boolean(run.runClubId || run.runClub?.name);
}
