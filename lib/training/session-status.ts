/**
 * Shared training session status derivation (web + server).
 * Complete = matched activity; Skipped = athlete action; Missed = past unmatched (with grace).
 */

export type SessionStatus =
  | "completed"
  | "skipped"
  | "missed"
  | "today"
  | "upcoming"
  | "rest";

export function localYmdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localTodayKey(): string {
  return localYmdFromDate(new Date());
}

/** Whole calendar days from dateKey through today (0 = today, 1 = yesterday). */
export function calendarDaysFromDateKeyToToday(
  dateKey: string,
  todayKey: string
): number {
  const d = new Date(`${dateKey}T12:00:00`);
  const t = new Date(`${todayKey}T12:00:00`);
  return Math.round((t.getTime() - d.getTime()) / 86400000);
}

/**
 * Past unmatched workouts are not "missed" until grace expires:
 * - yesterday: missed only after local noon (still time to run in the morning)
 * - two+ calendar days ago: missed
 */
export function isPastDateKeyMissed(
  dateKey: string,
  todayKey: string,
  now: Date = new Date()
): boolean {
  if (dateKey >= todayKey) return false;
  const daysAgo = calendarDaysFromDateKeyToToday(dateKey, todayKey);
  if (daysAgo >= 2) return true;
  if (daysAgo === 1) return now.getHours() >= 12;
  return false;
}

export function deriveSessionStatus(params: {
  dateKey: string;
  matchedActivityId?: string | null;
  skippedAt?: string | Date | null;
  workoutType?: string;
  title?: string;
  /** For tests; defaults to now. */
  now?: Date;
}): SessionStatus {
  const { dateKey, matchedActivityId, skippedAt, workoutType, title } = params;
  const now = params.now ?? new Date();
  const isRest =
    workoutType === "Rest" || title === "Rest" || (!workoutType && !title);
  if (isRest) return "rest";
  if (matchedActivityId) return "completed";
  if (skippedAt) return "skipped";
  const today = localYmdFromDate(now);
  if (dateKey === today) return "today";
  if (dateKey > today) return "upcoming";
  if (isPastDateKeyMissed(dateKey, today, now)) return "missed";
  // Grace window: still actionable (yesterday morning, etc.)
  return "today";
}

export function sessionStatusLabel(status: SessionStatus): string {
  switch (status) {
    case "completed":
      return "Complete";
    case "skipped":
      return "Skipped";
    case "missed":
      return "Missed";
    case "today":
      return "Today";
    case "upcoming":
      return "Upcoming";
    case "rest":
      return "Rest";
  }
}

export function sessionStatusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "skipped":
      return "bg-neutral-200 text-neutral-700";
    case "missed":
      return "bg-red-50 text-red-800";
    case "today":
      return "bg-orange-100 text-orange-900";
    case "upcoming":
      return "bg-sky-50 text-sky-900";
    case "rest":
      return "bg-neutral-100 text-neutral-500";
  }
}
