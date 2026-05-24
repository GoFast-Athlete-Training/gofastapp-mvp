/**
 * Shared training session status derivation (web + server).
 * Complete = matched activity; Skipped = athlete action; Missed = past unmatched.
 */

export type SessionStatus =
  | "completed"
  | "skipped"
  | "missed"
  | "today"
  | "upcoming"
  | "rest";

export function localTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function deriveSessionStatus(params: {
  dateKey: string;
  matchedActivityId?: string | null;
  skippedAt?: string | Date | null;
  workoutType?: string;
  title?: string;
}): SessionStatus {
  const { dateKey, matchedActivityId, skippedAt, workoutType, title } = params;
  const isRest =
    workoutType === "Rest" || title === "Rest" || (!workoutType && !title);
  if (isRest) return "rest";
  if (matchedActivityId) return "completed";
  if (skippedAt) return "skipped";
  const today = localTodayKey();
  if (dateKey === today) return "today";
  if (dateKey < today) return "missed";
  return "upcoming";
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
