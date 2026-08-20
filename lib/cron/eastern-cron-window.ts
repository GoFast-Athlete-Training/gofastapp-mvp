/** Current local hour (0–23) in America/New_York for cron guards without Vercel timezone support. */
export function easternHour(now: Date = new Date()): number {
  const hourText = now.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  return Number.parseInt(hourText, 10);
}

export function isEasternHour(now: Date, hour: number): boolean {
  return easternHour(now) === hour;
}
