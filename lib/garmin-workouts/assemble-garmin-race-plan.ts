import type { RacePlanBlock, RacePlanDocument } from "@/lib/races/race-plan-types";
import { blockDistanceMiles } from "@/lib/races/race-plan-types";
import { applyPaceBandMiStringsAsGarminSpeed } from "@/lib/garmin-workouts/garmin-pace-speed-band";
import {
  GarminDurationType,
  GarminIntensity,
  GarminSport,
  type GarminWorkout,
  type GarminWorkoutStep,
  convertMilesToMeters,
} from "@/lib/garmin-workouts/types";

export function assembleGarminRacePlanWorkout(params: {
  title: string;
  plan: RacePlanDocument;
}): GarminWorkout {
  const steps: GarminWorkoutStep[] = params.plan.blocks.map((block, i) =>
    racePlanBlockToGarminStep(block, i + 1)
  );

  return {
    workoutName: params.title.trim() || "Race plan",
    description: params.plan.goal?.trim() || undefined,
    sport: GarminSport.RUNNING,
    steps,
  };
}

function racePlanBlockToGarminStep(block: RacePlanBlock, stepOrder: number): GarminWorkoutStep {
  const miles = blockDistanceMiles(block);
  const step: GarminWorkoutStep = {
    stepOrder,
    type: "WorkoutStep",
    intensity: GarminIntensity.ACTIVE,
    description: block.cue.trim() || `Split ${stepOrder}`,
    durationType: GarminDurationType.DISTANCE,
    durationValue: convertMilesToMeters(miles),
  };

  if (block.paceLow && block.paceHigh) {
    applyPaceBandMiStringsAsGarminSpeed(step, block.paceLow, block.paceHigh, stepOrder);
  } else {
    step.targetType = undefined;
  }

  return step;
}
