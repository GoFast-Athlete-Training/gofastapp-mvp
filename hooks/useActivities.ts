'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

/**
 * Filter activities to only running activities (exclude wheelchair)
 */
const filterRunningActivities = (activities: any[]) => {
  if (!Array.isArray(activities)) return [];
  return activities.filter((activity) => {
    if (!activity.activityType) return false;
    const type = activity.activityType.toLowerCase();
    // Include activities with "running" or "run" in the type, but exclude wheelchair
    return (type.includes('running') || type === 'run') && !type.includes('wheelchair');
  });
};

/**
 * Calculate weekly totals for running activities only
 */
const calculateRunTotals = (activities: any[]) => {
  const totals: any = {
    totalDistance: 0,
    totalDuration: 0,
    totalCalories: 0,
    activityCount: activities.length,
  };

  activities.forEach((activity) => {
    if (activity.distance) totals.totalDistance += activity.distance;
    if (activity.duration) totals.totalDuration += activity.duration;
    if (activity.calories) totals.totalCalories += activity.calories;
  });

  // Convert distance from meters to miles (keep as number for formatting in components)
  totals.totalDistanceMiles = totals.totalDistance / 1609.34;

  return totals;
};

/**
 * useActivities - Fetches and manages activities for a specific period (RUNS ONLY)
 *
 * Behavior:
 * 1. For 'current' period: First tries to load from localStorage (fast)
 * 2. If empty or stale, fetches from backend
 * 3. Filters to only running activities (safety net)
 * 4. Recalculates totals for runs only
 * 5. Updates localStorage with fresh data (only for 'current' period)
 */
export default function useActivities(
  athleteId: string | null,
  period: string = 'current',
  forceRefresh: boolean = false
) {
  const [activities, setActivities] = useState<any[]>([]);
  const [weeklyTotals, setWeeklyTotals] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState('This Week');

  const fetchFromBackend = async (athleteIdParam: string, periodParam: string = period) => {
    try {
      console.log('🔄 ACTIVITIES: Fetching from backend for athleteId:', athleteIdParam, 'period:', periodParam);

      const response = await api.get(`/athlete/${athleteIdParam}/activities/weekly`, {
        params: { period: periodParam },
      });

      if (response.data?.success) {
        const fetchedActivities = response.data.activities || [];
        const fetchedTotals = response.data.weeklyTotals || null;
        const fetchedPeriodLabel = response.data.periodLabel || 'This Week';

        // Filter to runs only and recalculate totals (safety net - backend should already filter, but ensure consistency)
        const filteredRuns = filterRunningActivities(fetchedActivities);
        const recalculatedTotals = calculateRunTotals(filteredRuns);

        console.log(
          '✅ ACTIVITIES: Fetched from backend:',
          fetchedActivities.length,
          'total activities,',
          filteredRuns.length,
          'runs'
        );

        setActivities(filteredRuns);
        setWeeklyTotals(recalculatedTotals);
        setPeriodLabel(fetchedPeriodLabel);

        // Update localStorage cache only for 'current' period
        if (periodParam === 'current') {
          const model = LocalStorageAPI.getFullHydrationModel();
          LocalStorageAPI.setFullHydrationModel({
            ...model,
            weeklyActivities: filteredRuns,
            weeklyTotals: recalculatedTotals,
          });
          console.log('✅ ACTIVITIES: Updated localStorage cache with', filteredRuns.length, 'runs');
        }
      } else {
        throw new Error(response.data?.error || 'Failed to fetch activities');
      }
    } catch (err: any) {
      console.error('❌ ACTIVITIES: Backend fetch error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivities = async () => {
    if (!athleteId) {
      console.log('⏳ ACTIVITIES: Waiting for athleteId...');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Try localStorage first (only for 'current' period and unless force refresh)
      if (period === 'current' && !forceRefresh) {
        const model = LocalStorageAPI.getFullHydrationModel();
        const cachedActivities = model?.weeklyActivities || [];
        const cachedTotals = model?.weeklyTotals || null;

        if (cachedActivities.length > 0) {
          // Filter to runs only and recalculate totals (safety net)
          const filteredRuns = filterRunningActivities(cachedActivities);
          const recalculatedTotals = calculateRunTotals(filteredRuns);

          console.log(
            '✅ ACTIVITIES: Loaded from localStorage:',
            cachedActivities.length,
            'total activities,',
            filteredRuns.length,
            'runs'
          );
          setActivities(filteredRuns);
          setWeeklyTotals(recalculatedTotals);
          setPeriodLabel('This Week');
          setIsLoading(false);

          // Still fetch in background to update cache
          fetchFromBackend(athleteId, period).catch((err) => {
            console.warn('⚠️ ACTIVITIES: Background fetch failed (non-critical):', err);
          });
          return;
        }
      }

      // Fetch from backend
      await fetchFromBackend(athleteId, period);
    } catch (err: any) {
      console.error('❌ ACTIVITIES: Error fetching activities:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if we have an athleteId
    if (athleteId) {
      console.log('🔄 ACTIVITIES: useEffect triggered, athleteId:', athleteId, 'period:', period);
      fetchActivities();
    } else {
      console.log('⏳ ACTIVITIES: useEffect waiting for athleteId');
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId, period, forceRefresh]);

  const refresh = () => {
    fetchActivities();
  };

  return {
    activities,
    weeklyTotals,
    isLoading,
    error,
    refresh,
    periodLabel,
  };
}

