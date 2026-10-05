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
  raceRegistryId?: string | null;
  runStoreId?: string | null;
  specialEventId?: string | null;
};

export function isCityRunTypeValue(v: unknown): v is CityRunTypeValue {
  return typeof v === 'string' && (CITY_RUN_TYPES as readonly string[]).includes(v);
}

const CONTAINER_KEY_ORDER: (keyof CityRunRelationshipSnapshot)[] = [
  'raceRegistryId',
  'specialEventId',
  'runStoreId',
  'runClubId',
  'runCrewId',
  'athleteGeneratedId',
];

/** Infer type from container FKs present on the row (machine / legacy paths). */
export function resolveCityRunType(opts: CityRunRelationshipSnapshot): CityRunTypeValue {
  for (const key of CONTAINER_KEY_ORDER) {
    const v = opts[key];
    if (v) {
      const t = cityRunTypeFromContainerKey(key, v);
      if (t) return t;
    }
  }
  return 'OTHER';
}

export function cityRunTypeFromContainerKey(
  key: keyof CityRunRelationshipSnapshot,
  value: string | null | undefined
): CityRunTypeValue | null {
  if (!value) return null;
  switch (key) {
    case 'raceRegistryId':
      return 'RACE_SHAKEOUT';
    case 'specialEventId':
      return 'SPECIAL';
    case 'runStoreId':
      return 'RUN_STORE';
    case 'runClubId':
      return 'CLUB';
    case 'runCrewId':
      return 'RUN_CREW';
    case 'athleteGeneratedId':
      return 'INDIVIDUAL';
    default:
      return null;
  }
}

/** True when PATCH only sets associate stamps, not a container retarget. */
export function isAssociateStampRelationshipPatch(
  patch: Partial<CityRunRelationshipSnapshot>,
  existing: CityRunRelationshipSnapshot & { cityRunType?: CityRunTypeValue | null }
): boolean {
  const touched = CONTAINER_KEY_ORDER.filter((k) => patch[k] !== undefined);
  if (touched.length === 0) return false;

  const primaryContainer =
    existing.cityRunType === 'RACE_SHAKEOUT' && existing.raceRegistryId
      ? 'raceRegistryId'
      : existing.cityRunType === 'SPECIAL' && existing.specialEventId
        ? 'specialEventId'
        : null;

  if (!primaryContainer) return false;

  if (touched.length === 1 && touched[0] === 'runClubId') return true;

  return false;
}

/**
 * Stamp cityRunType from container FKs in this PATCH only.
 * Returns undefined when the patch should not change type (associate stamp).
 */
export function cityRunTypeFromRelationshipPatch(
  patch: Partial<CityRunRelationshipSnapshot>,
  existing: CityRunRelationshipSnapshot & { cityRunType?: CityRunTypeValue | null }
): CityRunTypeValue | undefined {
  if (isAssociateStampRelationshipPatch(patch, existing)) {
    return undefined;
  }

  const touched = CONTAINER_KEY_ORDER.filter((k) => patch[k] !== undefined);
  if (touched.length === 0) return undefined;

  for (const key of CONTAINER_KEY_ORDER) {
    if (patch[key] === undefined) continue;
    if (patch[key]) {
      return cityRunTypeFromContainerKey(key, patch[key]) ?? 'OTHER';
    }
    const merged = { ...existing, ...patch, [key]: null };
    return resolveCityRunType(merged);
  }

  return undefined;
}

/** Stamp from container FKs present on this create body only (priority among set keys). */
export function cityRunTypeFromCreateSnapshot(
  snapshot: CityRunRelationshipSnapshot
): CityRunTypeValue {
  for (const key of CONTAINER_KEY_ORDER) {
    const v = snapshot[key];
    if (v) {
      const t = cityRunTypeFromContainerKey(key, v);
      if (t) return t;
    }
  }
  return 'OTHER';
}

/** Staff create: explicit type is confirmed only when its container FK is set; else plain city run. */
export function cityRunTypeForWrite(
  explicit: unknown,
  snapshot: CityRunRelationshipSnapshot
): CityRunTypeValue {
  const fromContainers = cityRunTypeFromCreateSnapshot(snapshot);
  if (isCityRunTypeValue(explicit)) {
    if (explicit === fromContainers && fromContainers !== 'OTHER') return explicit;
    if (fromContainers !== 'OTHER') return fromContainers;
    return 'OTHER';
  }
  return fromContainers;
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
