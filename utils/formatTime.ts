/**
 * Format time from three fields (hour, minute, period) to display string
 * Examples: { hour: 6, minute: 15, period: 'AM' } -> "6:15 AM"
 */
export function formatTime(hour: number | null | undefined, minute: number | null | undefined, period: string | null | undefined): string {
  if (hour === null || hour === undefined || minute === null || minute === undefined) {
    return '';
  }
  
  const periodStr = period ? period.toUpperCase() : '';
  return `${hour}:${minute.toString().padStart(2, '0')} ${periodStr}`.trim();
}

/**
 * Format time from run object (new format with three fields, or fallback to old string format)
 */
export function formatRunTime(run: { startTimeHour?: number | null; startTimeMinute?: number | null; startTimePeriod?: string | null; startTime?: string | null }): string {
  // New format - use three fields
  if (run.startTimeHour !== null && run.startTimeHour !== undefined && run.startTimeMinute !== null && run.startTimeMinute !== undefined) {
    return formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod);
  }
  
  // Fallback to old string format (for backward compatibility during migration)
  if (run.startTime) {
    return run.startTime;
  }
  
  return '';
}

