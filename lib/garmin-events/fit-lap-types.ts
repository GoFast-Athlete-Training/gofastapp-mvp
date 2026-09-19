/**
 * Structured lap rows parsed from Garmin FIT activity files.
 * Stored on athlete_activities.fitLapData (not detailData — detail webhook replaces that blob).
 */

export type FitLapRow = {
  /** Normalized FIT intensity (warmup, interval, active, recovery, rest, cooldown, other). */
  type: string;
  /** Raw intensity string/number from FIT before normalization. */
  rawIntensity: string | null;
  startTimeInSeconds: number;
  elapsedSeconds: number | null;
  timerSeconds: number | null;
  distanceMeters: number | null;
  avgSpeedMps: number | null;
  avgHeartRate: number | null;
  avgCadence: number | null;
  wktStepIndex: number | null;
};

export type FitLapDataPayload = {
  fileType: string;
  processedAt: string;
  sourceActivityId: string;
  sessionStartTimeInSeconds: number | null;
  laps: FitLapRow[];
};

export const KNOWN_FIT_LAP_INTENSITIES = new Set([
  "active",
  "rest",
  "warmup",
  "cooldown",
  "recovery",
  "interval",
  "other",
]);
