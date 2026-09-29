/**
 * Club run date display — delegates to universal civil-date formatting in calendar-date.ts
 * (mirrors gofastapp-mvp/lib/calendar-date.ts).
 */
import { formatCalendarDate } from "@/lib/calendar-date";

export function formatRunCalendarDate(
  isoOrYmd: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const trimmed = isoOrYmd.trim();
  if (!trimmed) return "—";
  return formatCalendarDate(trimmed, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}
