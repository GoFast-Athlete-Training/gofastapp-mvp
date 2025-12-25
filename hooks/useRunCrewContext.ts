'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

/**
 * useRunCrewContext Hook
 * 
 * CREW CONTEXT HYDRATION - Hydrates full crew data ONLY on /runcrew/* routes.
 * 
 * This hook:
 * - Checks localStorage cache first
 * - If missing or stale, calls /runcrew/hydrate
 * - Stores result to localStorage
 * - Returns crew with full context (members, messages, runs, announcements)
 * 
 * Usage:
 * - ONLY use on /runcrew/* pages
 * - NEVER use on athlete-home
 * - NEVER use in components
 * 
 * @param runCrewId - Optional crew ID (defaults to route param)
 * @returns {Object} { runCrew, loading, hydrated, error }
 */
export default function useRunCrewContext(runCrewId?: string) {
  const params = useParams();
  const crewIdFromRoute = params.id as string | undefined;
  const targetCrewId = runCrewId || crewIdFromRoute;

  const [runCrew, setRunCrew] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetCrewId) {
      setLoading(false);
      return;
    }

    const loadCrewContext = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check localStorage cache first
        const cachedCrew = LocalStorageAPI.getPrimaryCrew() || LocalStorageAPI.getRunCrewData();
        
        // If cached crew matches requested ID, use it
        if (cachedCrew && cachedCrew.id === targetCrewId) {
          console.log('✅ useRunCrewContext: Using cached crew:', cachedCrew.name);
          setRunCrew(cachedCrew);
          setHydrated(true);
          setLoading(false);
          return;
        }

        // Cache miss or mismatch - hydrate from API
        console.log('🔄 useRunCrewContext: Hydrating crew context:', targetCrewId);
        const response = await api.post('/runcrew/hydrate', { runCrewId: targetCrewId });

        if (response.data.success && response.data.runCrew) {
          const crew = response.data.runCrew;
          
          // Store to localStorage
          LocalStorageAPI.setRunCrewData(crew);
          LocalStorageAPI.setPrimaryCrew(crew);
          
          setRunCrew(crew);
          setHydrated(true);
          console.log('✅ useRunCrewContext: Crew hydrated:', crew.name);
        } else {
          throw new Error(response.data.error || 'Failed to hydrate crew');
        }
      } catch (err: any) {
        console.error('❌ useRunCrewContext: Error hydrating crew:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load crew');
      } finally {
        setLoading(false);
      }
    };

    loadCrewContext();
  }, [targetCrewId]);

  return {
    runCrew,
    loading,
    hydrated,
    error,
  };
}

