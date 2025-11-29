/**
 * Format distance helper
 * Converts meters to miles and formats to 1 decimal place
 */
export function formatDistance(activity: { distance?: number | string | null }): string | null {
  if (!activity.distance) return null;
  // If distance is in meters, convert to miles
  if (typeof activity.distance === 'number') {
    const miles = activity.distance / 1609.34;
    return `${miles.toFixed(1)} miles`;
  }
  return activity.distance;
}

