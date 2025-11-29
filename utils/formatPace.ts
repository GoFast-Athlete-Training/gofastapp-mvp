/**
 * Format pace helper
 * Converts seconds per mile to min:sec/mi format
 * Handles both number and string inputs
 */
export function formatPace(activity: { pace?: number | string | null }): string | null {
  if (!activity.pace) return null;
  if (typeof activity.pace === 'string') return activity.pace;
  // If pace is in seconds per mile, convert to min:sec/mi
  if (typeof activity.pace === 'number') {
    const minutes = Math.floor(activity.pace / 60);
    const seconds = Math.floor(activity.pace % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
  }
  return null;
}

