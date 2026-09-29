/**
 * YYYY-MM-DD from the environment's local calendar (browser = user's TZ; server = machine TZ).
 * Use for "today" / date inputs — not for UTC date-only DB fields (use explicit UTC helpers there).
 */
export function localCalendarYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
