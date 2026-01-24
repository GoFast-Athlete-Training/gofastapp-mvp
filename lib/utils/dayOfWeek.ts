/**
 * Day of Week Utilities
 * 
 * Functions to infer and work with days of week for runs
 */

/**
 * Get day of week name from a Date object
 * @param date - Date object
 * @returns Day name: "Sunday", "Monday", "Tuesday", etc.
 */
export function getDayOfWeek(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Get day of week from a date string or Date object
 * @param dateInput - Date string or Date object
 * @returns Day name: "Sunday", "Monday", "Tuesday", etc.
 */
export function getDayOfWeekFromDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return getDayOfWeek(date);
}

/**
 * Filter runs by day of week
 * For recurring runs: uses dayOfWeek field
 * For single runs: infers day from startDate/date
 * 
 * @param runs - Array of runs
 * @param dayFilter - Day to filter by ("Monday", "Tuesday", etc.) or "All Days"
 * @returns Filtered array of runs
 */
export function filterRunsByDay<T extends {
  isRecurring: boolean;
  dayOfWeek?: string | null;
  startDate: Date | string;
  date?: Date | string;
}>(runs: T[], dayFilter: string): T[] {
  if (dayFilter === 'All Days' || !dayFilter) {
    return runs;
  }
  
  return runs.filter(run => {
    if (run.isRecurring) {
      // Recurring runs: use dayOfWeek field directly
      return run.dayOfWeek === dayFilter;
    } else {
      // Single runs: infer day from date
      const dateToUse = run.startDate || run.date;
      if (!dateToUse) return false;
      const day = getDayOfWeekFromDate(dateToUse);
      return day === dayFilter;
    }
  });
}

/**
 * Get all unique days of week from an array of runs
 * Useful for populating day filter dropdown
 * 
 * @param runs - Array of runs
 * @returns Array of unique day names
 */
export function getUniqueDaysFromRuns<T extends {
  isRecurring: boolean;
  dayOfWeek?: string | null;
  startDate: Date | string;
  date?: Date | string;
}>(runs: T[]): string[] {
  const days = new Set<string>();
  
  runs.forEach(run => {
    if (run.isRecurring && run.dayOfWeek) {
      days.add(run.dayOfWeek);
    } else {
      const dateToUse = run.startDate || run.date;
      if (dateToUse) {
        days.add(getDayOfWeekFromDate(dateToUse));
      }
    }
  });
  
  return Array.from(days).sort((a, b) => {
    const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayOrder.indexOf(a) - dayOrder.indexOf(b);
  });
}

