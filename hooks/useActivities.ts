'use client';

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
 * useActivities - LOCAL-FIRST hook for activities (RUNS ONLY)
 *
 * Behavior:
 * 1. Loads from localStorage ONLY - synchronous, no API calls, no useEffect
 * 2. Filters to only running activities
 * 3. Recalculates totals for runs only
 * 4. NO API calls, NO useEffect, NO state updates - just read from localStorage
 */
export default function useActivities(
  athleteId: string | null,
  period: string = 'current',
  forceRefresh: boolean = false
) {
  // Just read from localStorage synchronously - no state, no effects, no API calls
  const model = LocalStorageAPI.getFullHydrationModel();
  const cachedActivities = model?.weeklyActivities || [];
  const cachedTotals = model?.weeklyTotals || null;

  // Filter to runs only and recalculate totals
  const filteredRuns = filterRunningActivities(cachedActivities);
  const recalculatedTotals = cachedTotals || calculateRunTotals(filteredRuns);

  return {
    activities: filteredRuns,
    weeklyTotals: recalculatedTotals,
    isLoading: false,
    error: null,
    refresh: () => {}, // No-op - local-first means no refresh
    periodLabel: 'This Week',
  };
}

