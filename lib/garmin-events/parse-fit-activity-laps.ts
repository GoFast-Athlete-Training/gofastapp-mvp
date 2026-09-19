/**
 * Decode Garmin FIT activity bytes into structured lap rows (intensity, timing, metrics).
 * Pure aside from console.warn for unknown intensities.
 */

import { Decoder, Stream, Utils, type FitMessages, type LapMesg } from "@garmin/fitsdk";
import {
  KNOWN_FIT_LAP_INTENSITIES,
  type FitLapRow,
} from "./fit-lap-types";

export type ParsedFitActivity = {
  sessionStartTimeInSeconds: number | null;
  laps: FitLapRow[];
  decodeErrors: string[];
};

function toNum(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  return null;
}

function toUnixSecondsFromFitDateTime(value: unknown): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Math.floor(value.getTime() / 1000);
  }
  const n = toNum(value);
  if (n == null) return null;
  try {
    return Math.floor(Utils.convertDateTimeToDate(n).getTime() / 1000);
  } catch {
    return null;
  }
}

function normalizeIntensity(raw: unknown): { type: string; rawIntensity: string | null } {
  if (raw == null) {
    return { type: "other", rawIntensity: null };
  }
  const rawIntensity =
    typeof raw === "string"
      ? raw.trim()
      : typeof raw === "number" && Number.isFinite(raw)
        ? String(raw)
        : String(raw);
  const normalized = rawIntensity.toLowerCase();
  if (!KNOWN_FIT_LAP_INTENSITIES.has(normalized)) {
    console.warn(`⚠️ Unknown FIT lap intensity: ${rawIntensity}`);
  }
  return { type: normalized || "other", rawIntensity };
}

function lapMesgToRow(lap: LapMesg): FitLapRow | null {
  const startTimeInSeconds = toUnixSecondsFromFitDateTime(lap.startTime);
  if (startTimeInSeconds == null) return null;

  const { type, rawIntensity } = normalizeIntensity(lap.intensity);
  const avgCadence =
    toNum(lap.avgRunningCadence) ?? toNum(lap.avgCadence);

  return {
    type,
    rawIntensity,
    startTimeInSeconds,
    elapsedSeconds: toNum(lap.totalElapsedTime),
    timerSeconds: toNum(lap.totalTimerTime),
    distanceMeters: toNum(lap.totalDistance),
    avgSpeedMps: toNum(lap.avgSpeed),
    avgHeartRate: toNum(lap.avgHeartRate),
    avgCadence,
    wktStepIndex: toNum(lap.wktStepIndex),
  };
}

/** Extract laps + session start from decoded FIT messages (test hook). */
export function extractLapsFromFitMessages(messages: FitMessages): ParsedFitActivity {
  const decodeErrors: string[] = [];
  const sessionStartTimeInSeconds =
    messages.sessionMesgs?.[0]?.startTime != null
      ? toUnixSecondsFromFitDateTime(messages.sessionMesgs[0].startTime)
      : messages.activityMesgs?.[0]?.timestamp != null
        ? toUnixSecondsFromFitDateTime(messages.activityMesgs[0].timestamp)
        : null;

  const laps: FitLapRow[] = [];
  for (const lap of messages.lapMesgs ?? []) {
    const row = lapMesgToRow(lap);
    if (row) laps.push(row);
  }

  laps.sort((a, b) => a.startTimeInSeconds - b.startTimeInSeconds);

  return { sessionStartTimeInSeconds, laps, decodeErrors };
}

/** Decode FIT binary into structured lap rows. */
export function parseFitActivityLaps(bytes: Uint8Array): ParsedFitActivity {
  const stream = Stream.fromByteArray(bytes);
  if (!Decoder.isFIT(stream)) {
    throw new Error("Not a FIT file");
  }

  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read({
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    mergeHeartRates: true,
  });

  const parsed = extractLapsFromFitMessages(messages);
  parsed.decodeErrors = errors.map((e) => (e instanceof Error ? e.message : String(e)));
  return parsed;
}
