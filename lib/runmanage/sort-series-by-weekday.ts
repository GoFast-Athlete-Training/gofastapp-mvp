const WEEKDAY_ORDER: Record<string, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
};

export function weekdaySortIndex(dayOfWeek: string): number {
  return WEEKDAY_ORDER[dayOfWeek.trim().toUpperCase()] ?? 99;
}

export function compareSeriesByWeekdayTime(
  a: { dayOfWeek: string; startTimeHour: number | null; startTimeMinute: number | null },
  b: { dayOfWeek: string; startTimeHour: number | null; startTimeMinute: number | null }
): number {
  const day = weekdaySortIndex(a.dayOfWeek) - weekdaySortIndex(b.dayOfWeek);
  if (day !== 0) return day;
  const ah = a.startTimeHour ?? 99;
  const bh = b.startTimeHour ?? 99;
  if (ah !== bh) return ah - bh;
  const am = a.startTimeMinute ?? 0;
  const bm = b.startTimeMinute ?? 0;
  return am - bm;
}
