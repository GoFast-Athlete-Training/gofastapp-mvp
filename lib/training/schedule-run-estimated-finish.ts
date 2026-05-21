import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";

const METERS_PER_MILE = 1609.34;

/** Parse "6:30 AM" / "12:05 PM" into minutes since midnight. */
export function parseStartTimeLabel(label: string): number | null {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1]!, 10);
  const minute = parseInt(m[2]!, 10);
  const period = m[3]!.toUpperCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (period === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  return hour * 60 + minute;
}

export function formatMinutesSinceMidnight(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(wrapped / 60);
  const min = wrapped % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${period}`;
}

export function buildStartTimeLabel(
  hour: number,
  minute: number,
  period: "AM" | "PM"
): string {
  return `${hour}:${minute.toString().padStart(2, "0")} ${period}`;
}

/**
 * Estimated finish from start time + distance at easy-ish pace (5K pace + 90 sec/mi).
 */
export function computeEstimatedFinishLabel(params: {
  startTimeLabel: string | null | undefined;
  estimatedDistanceMi: number | null | undefined;
  fiveKPace: string | null | undefined;
}): string | null {
  const { startTimeLabel, estimatedDistanceMi, fiveKPace } = params;
  if (!startTimeLabel?.trim() || estimatedDistanceMi == null || estimatedDistanceMi <= 0) {
    return null;
  }
  const startMin = parseStartTimeLabel(startTimeLabel);
  if (startMin == null) return null;

  let paceSecPerMile: number | null = null;
  if (fiveKPace?.trim()) {
    try {
      paceSecPerMile = parsePaceToSecondsPerMile(fiveKPace.trim()) + 90;
    } catch {
      paceSecPerMile = null;
    }
  }
  if (paceSecPerMile == null || paceSecPerMile <= 0) {
    paceSecPerMile = 540;
  }

  const durationMin = (estimatedDistanceMi * paceSecPerMile) / 60;
  const finishMin = Math.round(startMin + durationMin);
  return formatMinutesSinceMidnight(finishMin);
}

export function metersToMilesNumber(meters: number | null | undefined): number | null {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return null;
  return meters / METERS_PER_MILE;
}
