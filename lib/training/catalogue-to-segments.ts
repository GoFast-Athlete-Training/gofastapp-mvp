/**
 * Build workout_segments payload from a catalogue row + schedule miles + anchor 5K pace.
 * Keeps Garmin push working while prescription truth lives on workout_catalogue.
 */

import type { workout_catalogue, WorkoutType } from "@prisma/client";
import type { ApiSegment } from "@/lib/workout-generator/templates";
import {
  getTrainingPaces,
  paceTargetFromSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function secPerMile(
  anchor: number,
  offset: number | null | undefined,
  fallbackZoneSec: number
): number {
  if (offset == null) return fallbackZoneSec;
  return Math.max(1, anchor + offset);
}

export function catalogueEntryToApiSegments(params: {
  entry: workout_catalogue;
  scheduleMiles: number;
  anchorSecondsPerMile: number;
}): ApiSegment[] {
  const { entry, scheduleMiles, anchorSecondsPerMile } = params;
  const paces = getTrainingPaces(anchorSecondsPerMile);
  const totalMiles = scheduleMiles;

  const type = entry.workoutType as WorkoutType;

  if (type === "Easy") {
    const pace = secPerMile(
      anchorSecondsPerMile,
      entry.overallPaceOffsetSecPerMile,
      paces.easy
    );
    return [
      {
        stepOrder: 1,
        title: "Easy Run",
        durationType: "DISTANCE",
        durationValue: round(totalMiles, 2),
        targets: [paceTargetFromSecondsPerMile(pace)],
      },
    ];
  }

  if (type === "Tempo") {
    const warmupM =
      entry.warmupMiles ?? round(totalMiles * 0.15, 2);
    const cooldownM =
      entry.cooldownMiles ?? round(totalMiles * 0.15, 2);
    const mainM = round(
      Math.max(0.25, totalMiles - warmupM - cooldownM),
      2
    );
    const easyPace = secPerMile(
      anchorSecondsPerMile,
      entry.recoveryPaceOffsetSecPerMile,
      paces.easy
    );
    const tempoPace = secPerMile(
      anchorSecondsPerMile,
      entry.overallPaceOffsetSecPerMile,
      paces.tempo
    );
    let order = 1;
    const out: ApiSegment[] = [];
    if (warmupM > 0) {
      out.push({
        stepOrder: order++,
        title: "Warmup",
        durationType: "DISTANCE",
        durationValue: warmupM,
        targets: [paceTargetFromSecondsPerMile(easyPace)],
      });
    }
    out.push({
      stepOrder: order++,
      title: "Tempo",
      durationType: "DISTANCE",
      durationValue: mainM,
      targets: [paceTargetFromSecondsPerMile(tempoPace)],
    });
    if (cooldownM > 0) {
      out.push({
        stepOrder: order++,
        title: "Cooldown",
        durationType: "DISTANCE",
        durationValue: cooldownM,
        targets: [paceTargetFromSecondsPerMile(easyPace)],
      });
    }
    return out;
  }

  if (type === "LongRun") {
    const warmupM = entry.warmupMiles ?? round(totalMiles * 0.1, 2);
    const mpM = round(totalMiles * 0.15, 2);
    const longM = round(
      Math.max(0.25, totalMiles - warmupM - mpM - round(totalMiles * 0.05, 2)),
      2
    );
    const cdM = round(Math.max(0, totalMiles - warmupM - longM - mpM), 2);
    const easyP = secPerMile(
      anchorSecondsPerMile,
      entry.recoveryPaceOffsetSecPerMile,
      paces.easy
    );
    const longP = secPerMile(
      anchorSecondsPerMile,
      entry.overallPaceOffsetSecPerMile,
      paces.longRun
    );
    const mpP = secPerMile(anchorSecondsPerMile, null, paces.marathon);
    let order = 1;
    const out: ApiSegment[] = [];
    if (warmupM > 0) {
      out.push({
        stepOrder: order++,
        title: "Warmup",
        durationType: "DISTANCE",
        durationValue: warmupM,
        targets: [paceTargetFromSecondsPerMile(easyP)],
      });
    }
    out.push({
      stepOrder: order++,
      title: "Long Run",
      durationType: "DISTANCE",
      durationValue: longM,
      targets: [paceTargetFromSecondsPerMile(longP)],
    });
    out.push({
      stepOrder: order++,
      title: "Marathon Pace",
      durationType: "DISTANCE",
      durationValue: mpM,
      targets: [paceTargetFromSecondsPerMile(mpP)],
    });
    if (cdM > 0) {
      out.push({
        stepOrder: order++,
        title: "Cooldown",
        durationType: "DISTANCE",
        durationValue: cdM,
        targets: [paceTargetFromSecondsPerMile(easyP)],
      });
    }
    return out;
  }

  // Intervals
  const reps = entry.reps ?? 6;
  const repMiles = (entry.repDistanceMeters ?? 800) / 1609.34;
  const recMiles = (entry.recoveryDistanceMeters ?? 400) / 1609.34;
  const warmupM = entry.warmupMiles ?? round(totalMiles * 0.15, 2);
  const cooldownM = entry.cooldownMiles ?? round(totalMiles * 0.15, 2);
  const intPace = secPerMile(
    anchorSecondsPerMile,
    entry.repPaceOffsetSecPerMile,
    paces.interval
  );
  const recPace = secPerMile(
    anchorSecondsPerMile,
    entry.recoveryPaceOffsetSecPerMile,
    paces.recovery
  );
  const easyP = secPerMile(anchorSecondsPerMile, null, paces.easy);

  let order = 1;
  const out: ApiSegment[] = [];
  if (warmupM > 0) {
    out.push({
      stepOrder: order++,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: warmupM,
      targets: [paceTargetFromSecondsPerMile(easyP)],
    });
  }
  for (let i = 0; i < reps; i++) {
    out.push({
      stepOrder: order++,
      title: "Interval",
      durationType: "DISTANCE",
      durationValue: round(repMiles, 3),
      targets: [paceTargetFromSecondsPerMile(intPace)],
    });
    out.push({
      stepOrder: order++,
      title: "Recovery",
      durationType: "DISTANCE",
      durationValue: round(recMiles, 3),
      targets: [paceTargetFromSecondsPerMile(recPace)],
    });
  }
  if (cooldownM > 0) {
    out.push({
      stepOrder: order++,
      title: "Cooldown",
      durationType: "DISTANCE",
      durationValue: cooldownM,
      targets: [paceTargetFromSecondsPerMile(easyP)],
    });
  }
  return out;
}
