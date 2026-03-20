/**
 * Derive total training weeks from plan start and race date (inclusive of partial first week).
 */

export function totalWeeksFromDates(planStartDate: Date, raceDate: Date): number {
  const start = new Date(planStartDate);
  start.setUTCHours(0, 0, 0, 0);
  const race = new Date(raceDate);
  race.setUTCHours(0, 0, 0, 0);
  const diffMs = race.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 1;
  return Math.max(1, Math.ceil(diffDays / 7));
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** preferredDays: 1=Monday .. 7=Sunday */
export function preferredDaysToHuman(days: number[]): string {
  if (!days.length) return "not specified";
  return days
    .map((d) => DAY_NAMES[d === 7 ? 0 : d] ?? String(d))
    .join(", ");
}
