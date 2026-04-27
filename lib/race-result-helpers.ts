/** Format total seconds as H:MM:SS or M:SS (for display / API consistency). */
export function formatDurationSecondsToClock(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Pace sec/mile from duration (sec) and distance (meters). */
export function paceSecPerMileFromActivity(durationSec: number, distanceMeters: number): number | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
  const miles = distanceMeters / 1609.344;
  if (miles <= 0) return null;
  return Math.round(durationSec / miles);
}
