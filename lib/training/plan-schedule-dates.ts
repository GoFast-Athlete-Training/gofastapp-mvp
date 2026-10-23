/**
 * Calendar dates tied to athlete plan weeks (Monday-based training weeks).
 */

import { dateKeyToUtcNoonDate } from "@/lib/calendar-date";
import {
  dateKeyForDayInWeek as dateKeyForDayInWeekFromStart,
  resolveStartDayKey,
} from "@/lib/plan-calendar-day";
import {
  addDaysUtc,
  mondayUtcOfWeekContaining,
  planStartDayKeyFromRow,
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
export function dateKeyForDayInPlanWeek(
  planStartDate: Date,
  weekNumber: number,
  ourDow: number
): string {
  const startDay = resolveStartDayKey({ startDate: planStartDate, startDay: null });
  return dateKeyForDayInWeekFromStart(startDay, weekNumber, ourDow);
}

export function dateForDayInWeek(
  planStartDate: Date,
  weekNumber: number,
  ourDow: number
): Date {
  const key = dateKeyForDayInPlanWeek(planStartDate, weekNumber, ourDow);
  return dateKeyToUtcNoonDate(key);
}

/** When `startDay` is stamped on the plan, prefer it over deriving from `startDate`. */
export function dateForDayInWeekFromPlan(
  plan: { startDate: Date; startDay?: string | null },
  weekNumber: number,
  ourDow: number
): Date {
  const startDay = planStartDayKeyFromRow(plan);
  const key = dateKeyForDayInWeekFromStart(startDay, weekNumber, ourDow);
  return dateKeyToUtcNoonDate(key);
}
