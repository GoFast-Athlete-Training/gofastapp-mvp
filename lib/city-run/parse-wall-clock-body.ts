/** Parse 12h wall clock fields from API/JSON bodies (start or check-in). */
export function parseWallClockFromBody(body: Record<string, unknown>, prefix: "startTime" | "checkInTime") {
  const hourKey = `${prefix}Hour` as const;
  const minuteKey = `${prefix}Minute` as const;
  const periodKey = `${prefix}Period` as const;

  const bodyHour =
    body[hourKey] != null && Number.isFinite(Number(body[hourKey]))
      ? Number(body[hourKey])
      : null;
  const bodyMinute =
    body[minuteKey] != null && Number.isFinite(Number(body[minuteKey]))
      ? Number(body[minuteKey])
      : null;
  const bodyPeriod =
    typeof body[periodKey] === "string" && String(body[periodKey]).trim()
      ? String(body[periodKey]).trim()
      : null;

  const hasClock = bodyHour != null && bodyHour >= 1 && bodyHour <= 12;
  if (!hasClock) {
    return {
      hour: null as number | null,
      minute: null as number | null,
      period: null as string | null,
      hasClock: false,
    };
  }
  return {
    hour: bodyHour,
    minute: bodyMinute ?? 0,
    period: bodyPeriod ?? "AM",
    hasClock: true,
  };
}
