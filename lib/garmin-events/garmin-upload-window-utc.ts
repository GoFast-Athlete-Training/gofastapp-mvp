/**
 * Garmin Wellness GET /wellness-api/rest/activities allows at most a 86400s span
 * between uploadStartTimeInSeconds and uploadEndTimeInSeconds.
 * We interpret a YYYY-MM-DD string as the UTC calendar day (matches plan date keys + matcher utcDayBounds).
 */

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseUtcYmdToUploadWindow(ymd: string): {
  uploadStartTimeInSeconds: number;
  uploadEndTimeInSeconds: number;
  dateUtc: string;
} | null {
  const m = YMD.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const startMs = Date.UTC(y, mo - 1, d, 0, 0, 0, 0);
  const uploadStartTimeInSeconds = Math.floor(startMs / 1000);
  const uploadEndTimeInSeconds = uploadStartTimeInSeconds + 86400;
  return {
    uploadStartTimeInSeconds,
    uploadEndTimeInSeconds,
    dateUtc: `${m[1]}-${m[2]}-${m[3]}`,
  };
}
