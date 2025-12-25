'use client';

import { useState, useEffect } from 'react';
import { LocalStorageAPI } from '@/lib/localstorage';

/**
 * useHydratedAthlete Hook (similar to useOwner in IgniteBd-Next-combine)
 * 
 * SINGLE IDENTITY READER - Reads athlete identity data from localStorage.
 * Identity is hydrated by /athlete-welcome page ONLY.
 * 
 * This hook provides:
 * - Athlete profile and ID
 * - Crew context IDs (MyCrew, MyCrewManagerId)
 * - Weekly activities and totals
 * - Garmin connection status
 * 
 * NO API calls, NO side effects, NO direct localStorage reads outside this hook.
 * 
 * @returns {Object} { 
 *   athlete, 
 *   athleteId, 
 *   runCrewId, 
 *   runCrewManagerId, 
 *   weeklyActivities,
 *   weeklyTotals,
 *   garminConnected,
 *   loading, 
 *   hydrated 
 * }
 */
export default function useHydratedAthlete() {
  const [athlete, setAthlete] = useState<any>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [runCrewId, setRunCrewId] = useState<string | null>(null);
  const [runCrewManagerId, setRunCrewManagerId] = useState<string | null>(null);
  const [weeklyActivities, setWeeklyActivities] = useState<any[]>([]);
  const [weeklyTotals, setWeeklyTotals] = useState<any>(null);
  const [garminConnected, setGarminConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage (hydrated by welcome page)
  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Read athlete profile
    const storedAthlete = LocalStorageAPI.getAthleteProfile();
    const storedAthleteId = LocalStorageAPI.getAthleteId();

    if (storedAthlete) {
      setAthlete(storedAthlete);
      setHydrated(true);
    }
    if (storedAthleteId) {
      setAthleteId(storedAthleteId);
    }

    // V2 keys (preferred) with legacy fallback
    const myCrew = LocalStorageAPI.getMyCrew();
    const myCrewManagerId = LocalStorageAPI.getMyCrewManagerId();
    const legacyRunCrewId = LocalStorageAPI.getRunCrewId();
    const legacyRunCrewManagerId = LocalStorageAPI.getRunCrewManagerId();

    // Use V2 keys if available, otherwise fall back to legacy
    const crewId = myCrew || legacyRunCrewId || null;
    const crewManagerId = myCrewManagerId || legacyRunCrewManagerId || null;

    if (crewId) {
      setRunCrewId(crewId);
    }
    if (crewManagerId) {
      setRunCrewManagerId(crewManagerId);
    }

    // Read weekly activities and totals from hydration model
    const model = LocalStorageAPI.getFullHydrationModel();
    if (model?.weeklyActivities) {
      setWeeklyActivities(model.weeklyActivities);
    }
    if (model?.weeklyTotals) {
      setWeeklyTotals(model.weeklyTotals);
    }

    // Read Garmin connection status
    const storedGarmin = localStorage.getItem('garminConnected');
    if (storedGarmin === 'true') {
      setGarminConnected(true);
    }

    setLoading(false);
  }, []);

  return {
    athlete,
    athleteId,
    runCrewId,
    runCrewManagerId,
    weeklyActivities,
    weeklyTotals,
    garminConnected,
    loading,
    hydrated,
  };
}

// Export as useAthlete for convenience (similar to useOwner pattern)
export function useAthlete() {
  return useHydratedAthlete();
}

