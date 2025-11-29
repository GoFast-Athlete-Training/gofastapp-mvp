'use client';

import { LocalStorageAPI } from '@/lib/localstorage';

/**
 * useHydratedAthlete - Local-only context reader (HYDRATION V2)
 * Reads athlete and crew context from LocalStorageAPI
 * Uses V2 keys (MyCrew, MyCrewManagerId) with legacy fallback
 * Reads directly from localStorage on every render (always fresh)
 */
export default function useHydratedAthlete() {
  // Read from localStorage (always reads latest value on every render)
  const athlete = LocalStorageAPI.getAthleteProfile();
  const athleteId = LocalStorageAPI.getAthleteId();

  // V2 keys (preferred) with legacy fallback
  const myCrew = LocalStorageAPI.getMyCrew();
  const myCrewManagerId = LocalStorageAPI.getMyCrewManagerId();
  const legacyRunCrewId = LocalStorageAPI.getRunCrewId();
  const legacyRunCrewManagerId = LocalStorageAPI.getRunCrewManagerId();

  // Use V2 keys if available, otherwise fall back to legacy
  const runCrewId = myCrew || legacyRunCrewId || null;
  const runCrewManagerId = myCrewManagerId || legacyRunCrewManagerId || null;

  const runCrew = LocalStorageAPI.getRunCrewData();

  return {
    athlete,
    athleteId,
    runCrewId,
    runCrewManagerId,
    runCrew,
  };
}

