import { dateKeyFromDate } from "@/lib/calendar-date";
import { localCalendarYmd } from "@/lib/date-local";

const WEEKDAY_TO_JS: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/** Monday 00:00 local for the week containing `anchor`. */
export function startOfWeekMondayLocal(anchor = new Date()): Date {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export type WeekWindow = {
  startYmd: string;
  endYmd: string;
  /** Exclusive end (Monday of next week) as YMD for comparisons. */
  endExclusiveYmd: string;
};

export function weekWindowContaining(anchor = new Date(), weekOffset = 0): WeekWindow {
  const start = startOfWeekMondayLocal(anchor);
  start.setDate(start.getDate() + weekOffset * 7);
  const endExclusive = new Date(start);
  endExclusive.setDate(start.getDate() + 7);
  const endInclusive = new Date(endExclusive);
  endInclusive.setDate(endExclusive.getDate() - 1);
  return {
    startYmd: localCalendarYmd(start),
    endYmd: localCalendarYmd(endInclusive),
    endExclusiveYmd: localCalendarYmd(endExclusive),
  };
}

/** Civil date in [startYmd, endYmd] for canonical dayOfWeek, or null if not in window. */
export function ymdForDayInWeek(
  dayOfWeek: string,
  window: WeekWindow,
  anchor = new Date()
): string | null {
  const target = WEEKDAY_TO_JS[dayOfWeek.trim().toUpperCase()];
  if (target === undefined) return null;
  const start = new Date(`${window.startYmd}T12:00:00`);
  for (let i = 0; i < 7; i++) {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + i);
    if (cursor.getDay() === target) {
      const ymd = localCalendarYmd(cursor);
      if (ymd >= window.startYmd && ymd < window.endExclusiveYmd) return ymd;
    }
  }
  return null;
}

export function runYmdFromDate(date: Date): string {
  return dateKeyFromDate(date);
}

export function isYmdInWeek(ymd: string, window: WeekWindow): boolean {
  return ymd >= window.startYmd && ymd < window.endExclusiveYmd;
}
