/**
 * Build workout_segments payload from a catalogue row + schedule miles + anchors.
 * MP blocks can use goal race pace (mpSimulation) or 5K-derived zones (currentBuildup).
 */

import type { workout_catalogue, WorkoutType } from "@prisma/client";
import type { ApiSegment } from "@/lib/workout-generator/templates";
import {
  getTrainingPaces,
  paceTargetFromSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { isMpSimulationAnchor } from "@/lib/training/goal-pace-calculator";

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

/** Scale peak mpFraction by plan ladder (0–3 → 25%–100% of peak). */
export function effectiveMpFraction(
  peakFraction: number | null | undefined,
  planLadderIndex: number | null | undefined
): number {
  const peak =
    peakFraction != null && Number.isFinite(peakFraction) && peakFraction > 0
      ? Math.min(0.85, peakFraction)
      : 0.15;
  if (planLadderIndex == null || !Number.isFinite(planLadderIndex)) {
    return peak;
  }
  const idx = Math.max(0, Math.min(3, Math.floor(planLadderIndex)));
  const scale = 0.25 + (idx / 3) * 0.75;
  return Math.min(0.85, peak * scale);
}

function mpPaceSecPerMile(params: {
  entry: workout_catalogue;
  fitnessAnchorSec: number;
  racePaceSecPerMile: number | null;
}): number {
  const { entry, fitnessAnchorSec, racePaceSecPerMile } = params;
  const paces = getTrainingPaces(fitnessAnchorSec);
  if (isMpSimulationAnchor(entry.paceAnchor) && racePaceSecPerMile != null) {
    return secPerMile(
      racePaceSecPerMile,
      entry.overallPaceOffsetSecPerMile,
      racePaceSecPerMile
    );
  }
  return secPerMile(fitnessAnchorSec, null, paces.marathon);
}

export function catalogueEntryToApiSegments(params: {
  entry: workout_catalogue;
  scheduleMiles: number;
  anchorSecondsPerMile: number;
  /** Goal race pace (sec/mile); required for mpSimulation MP blocks when set on entry. */
  racePaceSecondsPerMile?: number | null;
  planLadderIndex?: number | null;
}): ApiSegment[] {
  const {
    entry,
    scheduleMiles,
    anchorSecondsPerMile,
    racePaceSecondsPerMile = null,
    planLadderIndex = null,
  } = params;
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
    const mpP = mpPaceSecPerMile({
      entry,
      fitnessAnchorSec: anchorSecondsPerMile,
      racePaceSecPerMile: racePaceSecondsPerMile,
    });

    const usesConfigurableMp =
      (entry.mpFraction != null && entry.mpFraction > 0) ||
      isMpSimulationAnchor(entry.paceAnchor);

    if (!usesConfigurableMp) {
      const warmupM = entry.warmupMiles ?? round(totalMiles * 0.1, 2);
      const mpM = round(totalMiles * 0.15, 2);
      const longM = round(
        Math.max(0.25, totalMiles - warmupM - mpM - round(totalMiles * 0.05, 2)),
        2
      );
      const cdM = round(Math.max(0, totalMiles - warmupM - longM - mpM), 2);
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

    const peakFrac =
      entry.mpFraction != null && entry.mpFraction > 0
        ? entry.mpFraction
        : 0.35;
    let mpM = round(totalMiles * effectiveMpFraction(peakFrac, planLadderIndex), 2);
    mpM = Math.min(mpM, round(totalMiles * 0.9, 2));
    mpM = Math.max(0.25, mpM);
    let easyRemain = round(Math.max(0.25, totalMiles - mpM), 2);

    const pos = (entry.mpBlockPosition ?? "BACK_HALF").toUpperCase();
    let order = 1;
    const out: ApiSegment[] = [];

    const pushEasy = (miles: number, title: string) => {
      if (miles <= 0.05) return;
      out.push({
        stepOrder: order++,
        title,
        durationType: "DISTANCE",
        durationValue: round(miles, 2),
        targets: [paceTargetFromSecondsPerMile(longP)],
      });
    };
    const pushMp = (miles: number) => {
      out.push({
        stepOrder: order++,
        title: "Goal marathon pace",
        durationType: "DISTANCE",
        durationValue: round(miles, 2),
        targets: [paceTargetFromSecondsPerMile(mpP)],
      });
    };

    if (pos === "FRONT_HALF") {
      pushMp(mpM);
      pushEasy(easyRemain, "Long Run");
      return out;
    }
    if (pos === "EVEN") {
      const half = round(easyRemain / 2, 2);
      const second = round(easyRemain - half, 2);
      pushEasy(half, "Long Run");
      pushMp(mpM);
      pushEasy(second, "Long Run");
      return out;
    }
    pushEasy(easyRemain, "Long Run");
    pushMp(mpM);
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
