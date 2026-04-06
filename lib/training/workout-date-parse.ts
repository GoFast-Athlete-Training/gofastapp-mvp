/** Optional schedule: YYYY-MM-DD (UTC noon) or ISO datetime; invalid values → undefined */
export function parseOptionalWorkoutDate(input: unknown): Date | undefined {
  if (input == null || input === "") return undefined;
  if (typeof input !== "string") return undefined;
  const s = input.trim();
  if (!s) return undefined;
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoDay) {
    const y = Number(isoDay[1]);
    const m = Number(isoDay[2]);
    const d = Number(isoDay[3]);
    if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  const hasTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  const parsed = new Date(hasTz ? s : `${s}Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}
