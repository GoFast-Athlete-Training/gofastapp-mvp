import { utcDateOnly } from "@/lib/training/plan-utils";

export type RacePhase = "pre" | "race_day" | "post_early" | "post_cooled";

function parseRaceDayUtc(iso: string): Date {
  const s = iso.trim();
  return utcDateOnly(new Date(s.includes("T") ? s : `${s}T12:00:00Z`));
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
  if (diffDays > 0) return "pre";
  if (diffDays === 0) return "race_day";
  if (diffDays >= -6) return "post_early";
  return "post_cooled";
}
