/**
 * Build planned workout steps from schedule type + miles + 5K anchor — no catalogue template.
 */

import type { WorkoutType } from "@prisma/client";
import {
  parsePaceToSecondsPerMile,
  paceTargetFromSecondsPerMile,
  secondsPerMileToSecondsPerKm,
} from "@/lib/workout-generator/pace-calculator";
import type { WorkoutStep } from "@/lib/training/prescription";
import { defaultWorkPaceBandSecPerMile } from "@/lib/training/planned-workout-segment-editable";

function segmentTitleForWorkoutType(workoutType: WorkoutType): string {
  if (workoutType === "Easy") return "Easy";
  if (workoutType === "LongRun") return "Long run";
  if (workoutType === "Tempo" || workoutType === "Intervals") return "Work";
  return "Work";
}

export function buildScheduleNativeWorkoutSteps(params: {
  workoutType: WorkoutType;
  miles: number;
  fiveKPace: string | null | undefined;
}): WorkoutStep[] {
  const miles = params.miles;
  if (!Number.isFinite(miles) || miles <= 0) return [];
  if (params.workoutType === "Race") return [];

  let anchorSec: number | null = null;
  const paceStr = params.fiveKPace?.trim();
  if (paceStr) {
    try {
      anchorSec = parsePaceToSecondsPerMile(paceStr);
    } catch {
      anchorSec = null;
    }
  }

  let targets: WorkoutStep["targets"];
  if (anchorSec != null && Number.isFinite(anchorSec)) {
    const band = defaultWorkPaceBandSecPerMile(anchorSec, params.workoutType);
    if (band.low === band.high) {
      targets = [paceTargetFromSecondsPerMile(band.low)];
    } else {
      targets = [
        {
          type: "PACE",
          valueLow: secondsPerMileToSecondsPerKm(band.low),
          valueHigh: secondsPerMileToSecondsPerKm(band.high),
        },
      ];
    }
  }

  return [
    {
      stepOrder: 1,
      title: segmentTitleForWorkoutType(params.workoutType),
      durationType: "DISTANCE",
      durationValue: Math.round(miles * 1000) / 1000,
      targets,
    },
  ];
}
