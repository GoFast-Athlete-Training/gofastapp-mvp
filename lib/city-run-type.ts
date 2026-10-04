import {
  CITY_RUN_TYPE_BY_CONTAINER,
  resolveCityRunContainer,
} from '@/lib/city-run/run-affiliations';

export const CITY_RUN_TYPES = [
  'CLUB',
  'INDIVIDUAL',
  'RACE_SHAKEOUT',
  'RUN_CREW',
  'RUN_STORE',
  'SPECIAL',
  'OTHER',
] as const;

export type CityRunTypeValue = (typeof CITY_RUN_TYPES)[number];

export type CityRunRelationshipSnapshot = {
  runClubId?: string | null;
  runCrewId?: string | null;
  athleteGeneratedId?: string | null;
  shakeoutDedupeKey?: string | null;
  raceRegistryId?: string | null;
  runStoreId?: string | null;
  specialEventId?: string | null;
};

export function isCityRunTypeValue(v: unknown): v is CityRunTypeValue {
  return typeof v === 'string' && (CITY_RUN_TYPES as readonly string[]).includes(v);
}

/**
 * Infer type when staff did not send cityRunType (legacy / machine paths).
 * Precedence lives in the association canon so reads and writes cannot diverge.
 *
 * @see lib/city-run/run-affiliations.ts
 */
export function resolveCityRunType(opts: CityRunRelationshipSnapshot): CityRunTypeValue {
  return CITY_RUN_TYPE_BY_CONTAINER[resolveCityRunContainer(opts).kind];
}

export function cityRunTypeForWrite(
  explicit: unknown,
  snapshot: CityRunRelationshipSnapshot
): CityRunTypeValue {
  if (isCityRunTypeValue(explicit)) return explicit;
  return resolveCityRunType(snapshot);
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
    runStoreId:
      patch.runStoreId !== undefined ? patch.runStoreId : existing.runStoreId,
    specialEventId:
      patch.specialEventId !== undefined ? patch.specialEventId : existing.specialEventId,
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
  'runStoreId',
  'specialEventId',
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

export function isIndividualHostedRun(run: {
  cityRunType?: string | null;
  athleteGeneratedId?: string | null;
}): boolean {
  if (run.cityRunType) return run.cityRunType === 'INDIVIDUAL';
  return Boolean(run.athleteGeneratedId);
}

/** Runs that use the full GoRun RSVP → chatter → check-in → post-run lifecycle. */
export function hasSocialRunLifecycle(run: {
  cityRunType?: string | null;
  runClubId?: string | null;
  runClub?: { name?: string } | null;
  runCrewId?: string | null;
  athleteGeneratedId?: string | null;
}): boolean {
  if (run.cityRunType) {
    return (
      run.cityRunType === 'CLUB' ||
      run.cityRunType === 'INDIVIDUAL' ||
      run.cityRunType === 'RUN_CREW' ||
      run.cityRunType === 'RUN_STORE'
    );
  }
  return (
    isClubRun(run) || isIndividualHostedRun(run) || Boolean(run.runCrewId)
  );
}
