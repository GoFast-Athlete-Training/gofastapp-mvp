/**
 * Registration deadlines are civil dates. Signup actions close once the stored
 * deadline calendar day is before today in UTC.
 */

function utcTodayYmd(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const mo = String(n.getUTCMonth() + 1).padStart(2, "0");
  const day = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function deadlineToUtcYmd(deadline: string | Date): string | null {
  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function isRegistrationDeadlinePastUtc(
  deadline: string | Date | null | undefined
): boolean {
  if (deadline == null) return false;
  const ymd = deadlineToUtcYmd(deadline);
  if (!ymd) return false;
  return ymd < utcTodayYmd();
}
