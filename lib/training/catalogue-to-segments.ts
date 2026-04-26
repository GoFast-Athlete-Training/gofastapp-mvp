/**
 * Build workout_segments payload from a catalogue row + schedule miles + anchors.
 * Segment fields mirror workout_catalogue (warmup / work base / ladder / cooldown).
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

/** Pyramid: max down to min by step, then back up (exclude duplicate min on ascent). */
export function ladderRungsMeters(maxM: number, minM: number, stepM: number): number[] {
  if (!Number.isFinite(maxM) || !Number.isFinite(minM) || !Number.isFinite(stepM)) {
    return [];
  }
  if (stepM <= 0 || maxM < minM) return [maxM];
  const down: number[] = [];
  for (let m = maxM; m >= minM; m -= stepM) {
    down.push(Math.round(m));
  }
  const up = down.length > 1 ? down.slice(0, -1).reverse() : [];
  return [...down, ...up];
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
      entry.workPaceOffsetSecPerMile,
      racePaceSecPerMile
    );
  }
  return secPerMile(
    fitnessAnchorSec,
    entry.mpPaceOffsetSecPerMile,
    paces.marathon
  );
}

function buildSustainedQualityBlock(params: {
  entry: workout_catalogue;
  totalMiles: number;
  anchorSecondsPerMile: number;
  title: string;
}): ApiSegment[] {
  const { entry, totalMiles, anchorSecondsPerMile, title } = params;
  const paces = getTrainingPaces(anchorSecondsPerMile);
  const warmupM = entry.warmupMiles ?? round(totalMiles * 0.15, 2);
  const cooldownM = entry.cooldownMiles ?? round(totalMiles * 0.15, 2);
  const prescribedMain = entry.workBaseMiles;
  const mainM = round(
    prescribedMain != null && prescribedMain > 0
      ? Math.min(prescribedMain, Math.max(0.25, totalMiles - warmupM - cooldownM))
      : Math.max(0.25, totalMiles - warmupM - cooldownM),
    2
  );
  const warmupPace = secPerMile(
    anchorSecondsPerMile,
    entry.warmupPaceOffsetSecPerMile ?? entry.recoveryPaceOffsetSecPerMile,
    paces.easy
  );
  const cooldownPace = secPerMile(
    anchorSecondsPerMile,
    entry.cooldownPaceOffsetSecPerMile ?? entry.recoveryPaceOffsetSecPerMile,
    paces.easy
  );
  const workPace = secPerMile(
    anchorSecondsPerMile,
    entry.workPaceOffsetSecPerMile,
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
      targets: [paceTargetFromSecondsPerMile(warmupPace)],
    });
  }
  out.push({
    stepOrder: order++,
    title,
    durationType: "DISTANCE",
    durationValue: mainM,
    targets: [paceTargetFromSecondsPerMile(workPace)],
  });
  if (cooldownM > 0) {
    out.push({
      stepOrder: order++,
      title: "Cooldown",
      durationType: "DISTANCE",
      durationValue: cooldownM,
      targets: [paceTargetFromSecondsPerMile(cooldownPace)],
    });
  }
  return out;
}

export function catalogueEntryToApiSegments(params: {
  entry: workout_catalogue;
  scheduleMiles: number;
  anchorSecondsPerMile: number;
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
      entry.workPaceOffsetSecPerMile,
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

  if (type === "LongRun") {
    const easyP = secPerMile(
      anchorSecondsPerMile,
      entry.recoveryPaceOffsetSecPerMile,
      paces.easy
    );
    const longP = secPerMile(
      anchorSecondsPerMile,
      entry.workPaceOffsetSecPerMile,
      paces.longRun
    );
    const mpP = mpPaceSecPerMile({
      entry,
      fitnessAnchorSec: anchorSecondsPerMile,
      racePaceSecPerMile: racePaceSecondsPerMile,
    });

    const usesConfigurableMp =
      entry.isMP ||
      (entry.mpTotalMiles != null && entry.mpTotalMiles > 0) ||
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

    let mpM: number;
    if (entry.mpTotalMiles != null && entry.mpTotalMiles > 0) {
      mpM = round(Math.min(entry.mpTotalMiles, totalMiles * 0.9), 2);
    } else {
      const peakFrac =
        entry.mpFraction != null && entry.mpFraction > 0 ? entry.mpFraction : 0.35;
      mpM = round(totalMiles * effectiveMpFraction(peakFrac, planLadderIndex), 2);
    }
    mpM = Math.min(mpM, round(totalMiles * 0.9, 2));
    mpM = Math.max(0.25, mpM);
    const easyRemain = round(Math.max(0.25, totalMiles - mpM), 2);

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

  const ladderMax = entry.maxLadderMeters;
  const ladderMin = entry.minLadderMeters;
  const ladderStep = entry.ladderStepMeters;
  if (
    entry.isLadder &&
    ladderMax != null &&
    ladderMin != null &&
    ladderStep != null &&
    (type === "Intervals" || type === "Tempo")
  ) {
    const rungs = ladderRungsMeters(ladderMax, ladderMin, ladderStep);
    if (rungs.length > 0) {
      const recMiles = (entry.recoveryDistanceMeters ?? 400) / 1609.34;
      const warmupM = entry.warmupMiles ?? round(totalMiles * 0.15, 2);
      const cooldownM = entry.cooldownMiles ?? round(totalMiles * 0.15, 2);
      const workPace = secPerMile(
        anchorSecondsPerMile,
        entry.workBasePaceOffsetSecPerMile,
        paces.interval
      );
      const recPace = secPerMile(
        anchorSecondsPerMile,
        entry.recoveryPaceOffsetSecPerMile,
        paces.recovery
      );
      const easyP = secPerMile(
        anchorSecondsPerMile,
        entry.warmupPaceOffsetSecPerMile,
        paces.easy
      );
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
      for (let i = 0; i < rungs.length; i++) {
        const repMiles = rungs[i] / 1609.34;
        out.push({
          stepOrder: order++,
          title: "Work",
          durationType: "DISTANCE",
          durationValue: round(repMiles, 3),
          targets: [paceTargetFromSecondsPerMile(workPace)],
        });
        if (i < rungs.length - 1) {
          out.push({
            stepOrder: order++,
            title: "Recovery",
            durationType: "DISTANCE",
            durationValue: round(recMiles, 3),
            targets: [paceTargetFromSecondsPerMile(recPace)],
          });
        }
      }
      if (cooldownM > 0) {
        out.push({
          stepOrder: order++,
          title: "Cooldown",
          durationType: "DISTANCE",
          durationValue: cooldownM,
          targets: [
            paceTargetFromSecondsPerMile(
              secPerMile(
                anchorSecondsPerMile,
                entry.cooldownPaceOffsetSecPerMile,
                paces.easy
              )
            ),
          ],
        });
      }
      return out;
    }
  }

  if (type === "Tempo") {
    return buildSustainedQualityBlock({
      entry,
      totalMiles,
      anchorSecondsPerMile,
      title: "Tempo",
    });
  }

  const reps = entry.workBaseReps ?? 6;
  const repMiles = (entry.workBaseRepMeters ?? 800) / 1609.34;
  const recMiles = (entry.recoveryDistanceMeters ?? 400) / 1609.34;
  const warmupM = entry.warmupMiles ?? round(totalMiles * 0.15, 2);
  const cooldownM = entry.cooldownMiles ?? round(totalMiles * 0.15, 2);
  const intPace = secPerMile(
    anchorSecondsPerMile,
    entry.workBasePaceOffsetSecPerMile,
    paces.interval
  );
  const recPace = secPerMile(
    anchorSecondsPerMile,
    entry.recoveryPaceOffsetSecPerMile,
    paces.recovery
  );
  const easyP = secPerMile(
    anchorSecondsPerMile,
    entry.warmupPaceOffsetSecPerMile,
    paces.easy
  );

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
      targets: [
        paceTargetFromSecondsPerMile(
          secPerMile(
            anchorSecondsPerMile,
            entry.cooldownPaceOffsetSecPerMile,
            paces.easy
          )
        ),
      ],
    });
  }
  return out;
}
