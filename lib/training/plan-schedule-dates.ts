/**
 * UTC calendar dates tied to athlete plan weeks (Monday-based training weeks).
 */

import {
  addDaysUtc,
  mondayUtcOfWeekContaining,
  utcDateOnly,
} from "@/lib/training/plan-utils";

/** Our convention: 1=Monday .. 7=Sunday */
export function ourDowToJs(our: number): number {
  return our === 7 ? 0 : our;
}

export function dateOnOurDowFromWeekMonday(
  weekMondayUtc: Date,
  ourDow: number
): Date {
  const anchor = utcDateOnly(weekMondayUtc);
  const targetJs = ourDowToJs(ourDow);
  for (let d = 0; d < 7; d++) {
    const candidate = addDaysUtc(anchor, d);
    if (candidate.getUTCDay() === targetJs) {
      return candidate;
    }
  }
  throw new Error(`Could not place day ${ourDow} in calendar week`);
}

/**
 * Week N = Nth Mon–Sun block starting at the Monday of the week that contains plan start.
 */
export function dateForDayInWeek(
  planStartDate: Date,
  weekNumber: number,
  ourDow: number
): Date {
  const firstMonday = mondayUtcOfWeekContaining(planStartDate);
  const weekMonday = addDaysUtc(firstMonday, (weekNumber - 1) * 7);
  return dateOnOurDowFromWeekMonday(weekMonday, ourDow);
}
