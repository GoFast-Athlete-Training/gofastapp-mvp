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
  qualityCount: number;
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
  return params.qualityCount === 0 && phase.includes("base") && params.totalMiles > 0;
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
  const quality = days.filter(
    (d) => d.workoutType === "Tempo" || d.workoutType === "Intervals"
  );
  const easyDays = days.filter((d) => d.workoutType === "Easy");
  const hasRace = days.some((d) => d.workoutType === "Race");
  const deload = isDeloadWeek({
    phaseLabel,
    totalMiles,
    previousWeekTotalMiles: params.previousWeekTotalMiles,
    qualityCount: quality.length,
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
  if (quality.length > 0) {
    chips.push(
      quality.length === 1
        ? `1 quality (${quality[0]!.workoutType === "Tempo" ? "tempo" : "intervals"})`
        : `${quality.length} quality sessions`
    );
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
  } else if (longRuns.length > 0 && quality.length > 0) {
    narrative = `This week pairs ${quality.length} quality session${quality.length === 1 ? "" : "s"} with easy days around a ${formatWeekCardMiles(longRuns[0]!.estimatedDistanceInMeters) || "long"} run on ${longRunDayLabel(longRuns[0]!).split(" · ")[0]?.toLowerCase() ?? "the weekend"}.`;
  } else if (longRuns.length > 0) {
    narrative = `Long run week — ${longRunDayLabel(longRuns[0]!)} anchors the schedule with easy aerobic days filling in the rest.`;
  } else if (quality.length > 0) {
    narrative = `Quality-focused week with ${quality.length} structured session${quality.length === 1 ? "" : "s"} and easy days for recovery between efforts.`;
  } else if (easyDays.length > 0) {
    narrative = "Mostly easy aerobic work this week — stay relaxed and keep mileage honest.";
  } else {
    narrative = "Tap a day below to see what's on the schedule this week.";
  }

  return { headline, narrative, chips, phaseLabel: theme };
}
