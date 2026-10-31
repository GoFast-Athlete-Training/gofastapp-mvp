import { raceCalendarDaysFromTodayUtc } from "@/lib/race-calendar-phase";
import {
  classifyRaceDistance,
  parseLifecycleHorizonOverrides,
  resolveHorizons,
  type RaceDistanceClass,
} from "@/lib/races/race-lifecycle/race-lifecycle-config";

export type RaceLifecyclePhase =
  | "past"
  | "raceDay"
  | "raceWeek"
  | "deepPrep"
  | "trainingCycle"
  | "discovery"
  | "noDate";

export type RaceLifecycleSnapshot = {
  daysUntilRace: number | null;
  distanceClass: RaceDistanceClass;
  phase: RaceLifecyclePhase;
};

export function computeRaceLifecyclePhase(input: {
  raceDate: Date | string | null | undefined;
  distanceMeters?: number | null;
  lifecycleHorizonOverrides?: unknown;
  now?: Date;
}): RaceLifecycleSnapshot {
  const raceDateIso =
    input.raceDate instanceof Date
      ? input.raceDate.toISOString()
      : input.raceDate ?? null;
  const daysUntil = raceCalendarDaysFromTodayUtc(raceDateIso);
  const distanceClass = classifyRaceDistance(input.distanceMeters);
  const overrides = parseLifecycleHorizonOverrides(input.lifecycleHorizonOverrides);
  if (daysUntil === null) {
    return { daysUntilRace: null, distanceClass, phase: "noDate" };
  }
  if (daysUntil < 0) {
    return { daysUntilRace: daysUntil, distanceClass, phase: "past" };
  }
  if (daysUntil === 0) {
    return { daysUntilRace: 0, distanceClass, phase: "raceDay" };
  }

  const horizons = resolveHorizons(distanceClass, overrides);
  const raceWeekDays = horizons.raceWeekDaysBefore;
  if (daysUntil <= raceWeekDays) {
    return { daysUntilRace: daysUntil, distanceClass, phase: "raceWeek" };
  }

  if (distanceClass === "marathon") {
    const marathonHorizons = resolveHorizons("marathon", overrides);
    if (daysUntil <= marathonHorizons.deepPrepDaysBefore) {
      return { daysUntilRace: daysUntil, distanceClass, phase: "deepPrep" };
    }
    if (daysUntil <= marathonHorizons.trainingCycleDaysBefore) {
      return {
        daysUntilRace: daysUntil,
        distanceClass,
        phase: "trainingCycle",
      };
    }
  }

  return { daysUntilRace: daysUntil, distanceClass, phase: "discovery" };
}

/** Map lifecycle phase to info-packet timing phase (backward compatible). */
export function lifecycleToInfoPacketPhase(
  lifecycle: RaceLifecyclePhase,
): "preRace" | "raceWeek" | "raceDay" | "past" {
  if (lifecycle === "past") return "past";
  if (lifecycle === "raceDay") return "raceDay";
  if (lifecycle === "raceWeek") return "raceWeek";
  return "preRace";
}
