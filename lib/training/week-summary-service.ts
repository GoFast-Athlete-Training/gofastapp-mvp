import type { PlanDayCard } from "@/lib/training/fetch-plan-week-client";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";
import { formatWeekCardMiles, weekTotalMilesDisplay } from "@/lib/training/plan-day-card-display";

export type WeekSummary = {
  headline: string;
  narrative: string;
  chips: string[];
  phaseLabel: string;
};

function titleCasePhase(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "Training";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizePhaseLabel(weekPhaseLabel?: string, days?: PlanDayCard[]): string {
  const fromParam = weekPhaseLabel?.trim();
  if (fromParam) return titleCasePhase(fromParam);
  const fromDay = days?.find((d) => d.phase?.trim())?.phase?.trim();
  if (fromDay) return titleCasePhase(fromDay);
  return "Training";
}

function isDeloadWeek(params: {
  phaseLabel: string;
  totalMiles: number;
  previousWeekTotalMiles?: number | null;
  structuredSessionCount: number;
}): boolean {
  const phase = params.phaseLabel.toLowerCase();
  if (phase.includes("deload") || phase.includes("recovery") || phase.includes("down")) {
    return true;
  }
  if (
    params.previousWeekTotalMiles != null &&
    params.previousWeekTotalMiles > 0 &&
    params.totalMiles > 0 &&
    params.totalMiles < params.previousWeekTotalMiles * 0.88
  ) {
    return true;
  }
  return params.structuredSessionCount === 0 && phase.includes("base") && params.totalMiles > 0;
}

function structuredSessionChip(tempoCount: number, intervalCount: number): string {
  const parts: string[] = [];
  if (tempoCount === 1) parts.push("Tempo");
  else if (tempoCount > 1) parts.push(`${tempoCount} tempo`);
  if (intervalCount === 1) parts.push("Intervals");
  else if (intervalCount > 1) parts.push(`${intervalCount} intervals`);
  return parts.join(" + ");
}

function structuredSessionNoun(tempoCount: number, intervalCount: number): string {
  const total = tempoCount + intervalCount;
  if (total === 1) {
    if (tempoCount === 1) return "tempo session";
    return "interval session";
  }
  return `${total} workouts`;
}

function longRunDayLabel(day: PlanDayCard): string {
  const weekday = formatPlanDateDisplay(day.dateKey || day.date, { weekday: "long" });
  const mi = formatWeekCardMiles(day.estimatedDistanceInMeters);
  return mi ? `${weekday} · ${mi}` : weekday;
}

/**
 * Pure week copy for plan calendar headers — no API calls.
 */
export function buildWeekSummary(params: {
  weekNumber: number;
  totalWeeks: number;
  days: PlanDayCard[];
  weekPhaseLabel?: string;
  previousWeekTotalMiles?: number | null;
}): WeekSummary {
  const { weekNumber, totalWeeks, days } = params;
  const phaseLabel = normalizePhaseLabel(params.weekPhaseLabel, days);
  const totalMiles =
    days.reduce((s, d) => s + (d.estimatedDistanceInMeters ?? 0), 0) / 1609.34;

  const longRuns = days.filter((d) => d.workoutType === "LongRun" || d.workoutType === "Race");
  const tempoSessions = days.filter((d) => d.workoutType === "Tempo");
  const intervalSessions = days.filter((d) => d.workoutType === "Intervals");
  const structuredSessionCount = tempoSessions.length + intervalSessions.length;
  const easyDays = days.filter((d) => d.workoutType === "Easy");
  const hasRace = days.some((d) => d.workoutType === "Race");
  const deload = isDeloadWeek({
    phaseLabel,
    totalMiles,
    previousWeekTotalMiles: params.previousWeekTotalMiles,
    structuredSessionCount,
  });

  let theme = phaseLabel;
  if (weekNumber === totalWeeks && hasRace) theme = "Race week";
  else if (deload) theme = "Deload";
  else if (phaseLabel.toLowerCase() === "taper") theme = "Taper";

  const headline = `Week ${weekNumber} of ${totalWeeks} · ${theme}`;
  const chips: string[] = [];

  if (days.length > 0) {
    chips.push(`${weekTotalMilesDisplay(days)} planned`);
  }
  if (longRuns.length > 0) {
    const lr = longRuns[0]!;
    chips.push(
      lr.workoutType === "Race"
        ? "Race day"
        : `Long run ${formatWeekCardMiles(lr.estimatedDistanceInMeters) || ""}`.trim()
    );
  }
  if (structuredSessionCount > 0) {
    chips.push(structuredSessionChip(tempoSessions.length, intervalSessions.length));
  }
  if (easyDays.length > 0) {
    chips.push(`${easyDays.length} easy ${easyDays.length === 1 ? "day" : "days"}`);
  }

  let narrative: string;
  if (weekNumber === totalWeeks && hasRace) {
    narrative = "Race week — keep the week light and trust the work you've already banked.";
  } else if (deload) {
    narrative =
      longRuns.length > 0
        ? `Volume pulls back this week. Easy days carry most of the load around a shorter ${formatWeekCardMiles(longRuns[0]!.estimatedDistanceInMeters) || ""} long run.`.replace(
            "  ",
            " "
          )
        : "Volume pulls back this week — easy days do most of the work while your legs absorb recent training.";
  } else if (longRuns.length > 0 && structuredSessionCount > 0) {
    narrative = `This week pairs ${structuredSessionNoun(tempoSessions.length, intervalSessions.length)} with easy days around a ${formatWeekCardMiles(longRuns[0]!.estimatedDistanceInMeters) || "long"} run on ${longRunDayLabel(longRuns[0]!).split(" · ")[0]?.toLowerCase() ?? "the weekend"}.`;
  } else if (longRuns.length > 0) {
    narrative = `Long run week — ${longRunDayLabel(longRuns[0]!)} anchors the schedule with easy aerobic days filling in the rest.`;
  } else if (structuredSessionCount > 0) {
    narrative = `Workout-focused week with ${structuredSessionNoun(tempoSessions.length, intervalSessions.length)} and easy days for recovery between efforts.`;
  } else if (easyDays.length > 0) {
    narrative = "Mostly easy aerobic work this week — stay relaxed and keep mileage honest.";
  } else {
    narrative = "Tap a day below to see what's on the schedule this week.";
  }

  return { headline, narrative, chips, phaseLabel: theme };
}
