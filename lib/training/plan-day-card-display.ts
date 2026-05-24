import type { PlanDayCard } from "@/lib/training/fetch-plan-week-client";

const MI_PER_M = 1609.34;

export function typeLabelForCard(workoutType: string): string {
  switch (workoutType) {
    case "Easy":
      return "Easy";
    case "Tempo":
      return "Tempo";
    case "Intervals":
      return "Intervals";
    case "LongRun":
      return "Long run";
    case "Race":
      return "Race";
    default:
      return "Run";
  }
}

/** Bold primary line: catalogue / custom title when present; else type label. */
export function workoutCardPrimaryName(w: PlanDayCard): string {
  const raw = w.title.trim();
  if (/^Race\s*—/i.test(raw)) return raw;
  if (/\b—\s*Week\s*\d+/i.test(raw) || /\bWeek\s*\d+\s*$/i.test(raw)) {
    return typeLabelForCard(w.workoutType);
  }
  if (raw.length > 0) return raw;
  return typeLabelForCard(w.workoutType);
}

export function weekTotalMilesDisplay(days: PlanDayCard[]): string {
  const m = days.reduce((s, d) => s + (d.estimatedDistanceInMeters ?? 0), 0) / MI_PER_M;
  if (!Number.isFinite(m) || m <= 0) return "—";
  const rounded = Math.round(m * 10) / 10;
  return `${rounded} mi`;
}

export function formatWeekCardMiles(estimatedDistanceInMeters: number | null | undefined): string {
  if (estimatedDistanceInMeters == null || !Number.isFinite(estimatedDistanceInMeters)) {
    return "";
  }
  const mi = estimatedDistanceInMeters / MI_PER_M;
  const rounded =
    Math.abs(mi - Math.round(mi)) < 0.06 ? Math.round(mi) : Math.round(mi * 10) / 10;
  return `${rounded} mi`;
}

export function workoutTypeLeftBorderClass(workoutType: string): string {
  switch (workoutType) {
    case "Easy":
      return "bg-green-400";
    case "LongRun":
      return "bg-purple-500";
    case "Tempo":
      return "bg-amber-400";
    case "Intervals":
      return "bg-orange-500";
    case "Race":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

export function workoutCardSubtypeLine(w: PlanDayCard): string {
  const mi = formatWeekCardMiles(w.estimatedDistanceInMeters);
  return `${typeLabelForCard(w.workoutType)}${mi ? ` · ${mi}` : ""}`;
}
