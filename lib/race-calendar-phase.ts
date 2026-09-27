import { utcDateOnly } from "@/lib/training/plan-utils";

export type RacePhase = "pre" | "day_before" | "race_day" | "post_early" | "post_cooled";

function localDateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseRaceDayUtc(iso: string): Date {
  const s = iso.trim();
  return utcDateOnly(new Date(s.includes("T") ? s : `${s}T12:00:00Z`));
}

/** Calendar race day in the athlete's local timezone (home banners, on-open prep). */
function parseRaceDayLocal(iso: string): Date {
  const s = iso.trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) {
    return localDateOnly(
      new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    );
  }
  return localDateOnly(new Date(s.includes("T") ? s : `${s}T12:00:00`));
}

/** Signed calendar days from today's UTC date to race day: positive = race in future, negative = race in past. */
export function raceCalendarDaysFromTodayUtc(
  raceDateIso: string | null | undefined
): number | null {
  if (!raceDateIso || typeof raceDateIso !== "string") return null;
  const today = utcDateOnly(new Date());
  const raceDay = parseRaceDayUtc(raceDateIso);
  if (Number.isNaN(raceDay.getTime())) return null;
  return Math.round((raceDay.getTime() - today.getTime()) / 86_400_000);
}

export function getRacePhase(raceDateIso: string | null | undefined): RacePhase {
  if (!raceDateIso || typeof raceDateIso !== "string") return "pre";
  const diffDays = raceCalendarDaysFromTodayUtc(raceDateIso);
  if (diffDays === null || Number.isNaN(diffDays)) return "pre";
  if (diffDays > 1) return "pre";
  if (diffDays === 1) return "day_before";
  if (diffDays === 0) return "race_day";
  if (diffDays >= -6) return "post_early";
  return "post_cooled";
}

/** Signed calendar days from today's local date to race day. */
export function raceCalendarDaysFromTodayLocal(
  raceDateIso: string | null | undefined
): number | null {
  if (!raceDateIso || typeof raceDateIso !== "string") return null;
  const today = localDateOnly(new Date());
  const raceDay = parseRaceDayLocal(raceDateIso);
  if (Number.isNaN(raceDay.getTime())) return null;
  return Math.round((raceDay.getTime() - today.getTime()) / 86_400_000);
}

/** On-open athlete UX — local calendar, not UTC training-week anchors. */
export function getRacePhaseLocal(raceDateIso: string | null | undefined): RacePhase {
  if (!raceDateIso || typeof raceDateIso !== "string") return "pre";
  const diffDays = raceCalendarDaysFromTodayLocal(raceDateIso);
  if (diffDays === null || Number.isNaN(diffDays)) return "pre";
  if (diffDays > 1) return "pre";
  if (diffDays === 1) return "day_before";
  if (diffDays === 0) return "race_day";
  if (diffDays >= -6) return "post_early";
  return "post_cooled";
}

/** Product default for server cron — calendar YMD in a US timezone (not UTC midnight flip). */
export const RACE_CALENDAR_TIMEZONE = "America/Denver";

export function calendarDayKeyInTimezone(
  value: Date | string,
  timeZone = RACE_CALENDAR_TIMEZONE
): string {
  const d = value instanceof Date ? value : new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
