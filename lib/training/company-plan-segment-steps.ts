import type { WorkoutType } from "@prisma/client";
import { parseWorkoutType } from "@/lib/training/catalogue-row";
import type { WorkoutStep } from "@/lib/training/prescription";

const STAFF_SEGMENT_TYPES = new Set<WorkoutType>(["Easy", "Tempo", "Intervals", "LongRun"]);

export function milesFromSegmentSteps(steps: WorkoutStep[]): number {
  let miles = 0;
  for (const step of steps) {
    const reps = step.repeatCount && step.repeatCount > 1 ? step.repeatCount : 1;
    if (step.durationType === "DISTANCE") miles += step.durationValue * reps;
    if (
      step.recoveryDurationType === "DISTANCE" &&
      step.recoveryDurationValue != null &&
      reps > 1
    ) {
      miles += step.recoveryDurationValue * (reps - 1);
    }
  }
  return Math.round(miles * 10) / 10;
}

export function parseStaffSegmentWrite(body: {
  title?: unknown;
  workoutType?: unknown;
  steps?: unknown;
}):
  | { ok: true; title: string; workoutType: WorkoutType; steps: WorkoutStep[] }
  | { ok: false; error: string } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 120) {
    return { ok: false, error: "title is required" };
  }
  const workoutType = parseWorkoutType(body.workoutType);
  if (!workoutType || !STAFF_SEGMENT_TYPES.has(workoutType)) {
    return { ok: false, error: "workoutType must be Easy, Tempo, Intervals, or LongRun" };
  }
  if (!Array.isArray(body.steps) || body.steps.length === 0 || body.steps.length > 40) {
    return { ok: false, error: "steps must be 1 to 40 segment rows" };
  }

  const steps: WorkoutStep[] = [];
  for (let i = 0; i < body.steps.length; i++) {
    const raw = body.steps[i];
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: `Step ${i + 1} is invalid` };
    }
    const row = raw as Record<string, unknown>;
    const stepTitle = typeof row.title === "string" ? row.title.trim() : "";
    if (!stepTitle || stepTitle.length > 120) {
      return { ok: false, error: `Step ${i + 1} needs a title` };
    }
    const durationType =
      row.durationType === "TIME" ? "TIME" : row.durationType === "DISTANCE" ? "DISTANCE" : null;
    if (!durationType) {
      return { ok: false, error: `Step ${i + 1}: durationType must be DISTANCE or TIME` };
    }
    const durationValue =
      typeof row.durationValue === "number" ? row.durationValue : Number(row.durationValue);
    if (!Number.isFinite(durationValue) || durationValue <= 0 || durationValue > 500) {
      return { ok: false, error: `Step ${i + 1}: durationValue must be a positive number` };
    }

    let repeatCount: number | undefined;
    if (row.repeatCount != null && row.repeatCount !== "") {
      const n = typeof row.repeatCount === "number" ? row.repeatCount : Number(row.repeatCount);
      if (!Number.isInteger(n) || n < 2 || n > 50) {
        return { ok: false, error: `Step ${i + 1}: repeatCount must be 2–50` };
      }
      repeatCount = n;
    }

    let recoveryDurationType: "DISTANCE" | "TIME" | null = null;
    let recoveryDurationValue: number | null = null;
    if (row.recoveryDurationType != null && row.recoveryDurationType !== "") {
      if (row.recoveryDurationType !== "DISTANCE" && row.recoveryDurationType !== "TIME") {
        return { ok: false, error: `Step ${i + 1}: recoveryDurationType must be DISTANCE or TIME` };
      }
      const recoveryValue =
        typeof row.recoveryDurationValue === "number"
          ? row.recoveryDurationValue
          : Number(row.recoveryDurationValue);
      if (!Number.isFinite(recoveryValue) || recoveryValue <= 0 || recoveryValue > 500) {
        return { ok: false, error: `Step ${i + 1}: recoveryDurationValue must be a positive number` };
      }
      recoveryDurationType = row.recoveryDurationType;
      recoveryDurationValue = recoveryValue;
    }

    let targets: WorkoutStep["targets"];
    if (row.targets != null) {
      if (!Array.isArray(row.targets) || row.targets.length !== 1) {
        return { ok: false, error: `Step ${i + 1}: pace target is invalid` };
      }
      const target = row.targets[0] as Record<string, unknown>;
      const valueLow = typeof target.valueLow === "number" ? target.valueLow : Number(target.valueLow);
      const valueHigh =
        typeof target.valueHigh === "number" ? target.valueHigh : Number(target.valueHigh);
      if (
        target.type !== "PACE" ||
        !Number.isFinite(valueLow) ||
        !Number.isFinite(valueHigh) ||
        valueLow <= 0 ||
        valueHigh <= 0
      ) {
        return { ok: false, error: `Step ${i + 1}: pace target is invalid` };
      }
      targets = [
        {
          type: "PACE",
          valueLow: Math.min(valueLow, valueHigh),
          valueHigh: Math.max(valueLow, valueHigh),
        },
      ];
    }

    steps.push({
      stepOrder: i + 1,
      title: stepTitle,
      durationType,
      durationValue,
      ...(repeatCount ? { repeatCount } : {}),
      ...(targets ? { targets } : {}),
      ...(recoveryDurationType ? { recoveryDurationType, recoveryDurationValue } : {}),
    });
  }

  return { ok: true, title, workoutType, steps };
}
