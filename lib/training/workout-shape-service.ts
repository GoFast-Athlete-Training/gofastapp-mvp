/**
 * workoutshapeservice — structure only (durations, repeat counts, effort/rest labels). No pace numbers.
 */

import {
  tryParsePastedWorkoutText,
  type ParsedPasteSegment,
  type ParsedPasteWorkout,
} from "@/lib/training/parse-pasted-workout";

export type ShapeEffortLabel =
  | "easy"
  | "10k"
  | "tempo"
  | "marathon"
  | "interval"
  | "steady"
  | "work"
  | "rest"
  | string;

export type ShapeStep =
  | {
      kind: "effort";
      durationType: "DISTANCE" | "TIME";
      durationValue: number;
      effortLabel: ShapeEffortLabel;
      title: string;
    }
  | {
      kind: "rest";
      durationType: "DISTANCE" | "TIME";
      durationValue: number;
      title: string;
    };

export type ShapeRepeatBlock = {
  kind: "repeat";
      repeatCount: number;
  /** Steps inside one repetition (e.g. 1′ @ 10K then 1′ steady). */
  steps: ShapeStep[];
  /** Between-rep rest on a single-effort repeat (e.g. 2×3 mi with 120s rest). */
  betweenRepRest?: { durationType: "DISTANCE" | "TIME"; durationValue: number };
};

export type ShapeBookend = {
  kind: "bookend";
  title: "Warmup" | "Cooldown" | string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
};

export type WorkoutShapePiece = ShapeBookend | ShapeRepeatBlock;

export type WorkoutShape = {
  pieces: WorkoutShapePiece[];
  suggestedTitle: string;
  suggestedDescription: string;
};

function effortLabelFromContext(ctx: string, title: string): ShapeEffortLabel {
  const t = `${ctx} ${title}`.toLowerCase();
  if (/\bsteady\b/.test(t)) return "steady";
  if (/\b10\s*k\b|\b10k\b/.test(t)) return "10k";
  if (/\b5\s*k\b|\b5k\b/.test(t)) return "10k";
  if (/\bmarathon\b|\bmp\b/.test(t)) return "marathon";
  if (/\btempo\b|\bthreshold\b/.test(t)) return "tempo";
  if (/\beasy\b/.test(t)) return "easy";
  if (/\binterval\b/.test(t)) return "interval";
  return title.trim() || "work";
}

function parsedSegmentToShapeStep(seg: ParsedPasteSegment): ShapeStep | null {
  const ctx = seg.effortContext ?? seg.title ?? "";
  if (
    seg.recoveryDurationType &&
    seg.recoveryDurationValue != null &&
    seg.recoveryDurationValue > 0 &&
    (seg.repeatCount ?? 0) <= 1
  ) {
    return {
      kind: "rest",
      durationType: seg.recoveryDurationType,
      durationValue: seg.recoveryDurationValue,
      title: "Recovery",
    };
  }
  const label = effortLabelFromContext(ctx, seg.title);
  if (label === "rest") {
    return {
      kind: "rest",
      durationType: seg.durationType,
      durationValue: seg.durationValue,
      title: seg.title || "Recovery",
    };
  }
  return {
    kind: "effort",
    durationType: seg.durationType,
    durationValue: seg.durationValue,
    effortLabel: label,
    title: seg.title,
  };
}

export function workoutShapeFromParsed(parsed: ParsedPasteWorkout): WorkoutShape {
  const pieces: WorkoutShapePiece[] = [];

  for (const seg of parsed.segments) {
    const titleLower = seg.title.toLowerCase();
    if (titleLower.includes("warm")) {
      pieces.push({
        kind: "bookend",
        title: "Warmup",
        durationType: seg.durationType,
        durationValue: seg.durationValue,
      });
      continue;
    }
    if (titleLower.includes("cool")) {
      pieces.push({
        kind: "bookend",
        title: "Cooldown",
        durationType: seg.durationType,
        durationValue: seg.durationValue,
      });
      continue;
    }

    const cycle = seg.cycleSteps;
    if (cycle && cycle.length > 1 && (seg.repeatCount ?? 0) > 1) {
      const steps: ShapeStep[] = [];
      for (const leg of cycle) {
        const step = parsedSegmentToShapeStep(leg);
        if (step) steps.push(step);
      }
      if (steps.length >= 2) {
        pieces.push({
          kind: "repeat",
          repeatCount: seg.repeatCount ?? 1,
          steps,
        });
        continue;
      }
    }

    const reps = seg.repeatCount ?? 1;
    const betweenRepRest =
      reps > 1 &&
      seg.recoveryDurationType &&
      seg.recoveryDurationValue != null &&
      seg.recoveryDurationValue > 0
        ? {
            durationType: seg.recoveryDurationType,
            durationValue: seg.recoveryDurationValue,
          }
        : undefined;

    const effortStep = parsedSegmentToShapeStep({
      ...seg,
      repeatCount: undefined,
      recoveryDurationType: null,
      recoveryDurationValue: null,
    });
    if (!effortStep || effortStep.kind !== "effort") continue;

    pieces.push({
      kind: "repeat",
      repeatCount: reps,
      steps: [effortStep],
      ...(reps > 1 ? { betweenRepRest } : {}),
    });
  }

  return {
    pieces,
    suggestedTitle: parsed.suggestedTitle,
    suggestedDescription: parsed.suggestedDescription,
  };
}

/** Parse coach paste into a label-only workout shape (no paces). */
export function buildWorkoutShapeFromPaste(
  sourceText: string,
  workoutTypeHint: string = "Easy"
): WorkoutShape | null {
  const parsed = tryParsePastedWorkoutText(sourceText, workoutTypeHint);
  if (!parsed || parsed.segments.length === 0) return null;
  return workoutShapeFromParsed(parsed);
}
