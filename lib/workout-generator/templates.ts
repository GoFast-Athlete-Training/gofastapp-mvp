/**
 * Workout structure templates: map WorkoutType + total miles + training paces
 * to a list of segment descriptors (title, distance, pace zone).
 */

import type { PaceZone, TrainingPaces } from "./pace-calculator";
import { paceTargetFromSecondsPerMile } from "./pace-calculator";

export interface SegmentDescriptor {
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  paceZone: PaceZone;
  repeatCount?: number;
}

/** 800m in miles */
const M800 = 0.4971;
/** 400m in miles */
const M400 = 0.24855;

function easy(
  totalMiles: number,
  _paces: TrainingPaces
): SegmentDescriptor[] {
  return [
    { title: "Easy Run", durationType: "DISTANCE", durationValue: round(totalMiles, 2), paceZone: "easy" },
  ];
}

function tempo(
  totalMiles: number,
  _paces: TrainingPaces
): SegmentDescriptor[] {
  return [
    { title: "Warmup", durationType: "DISTANCE", durationValue: round(totalMiles * 0.15, 2), paceZone: "easy" },
    { title: "Tempo", durationType: "DISTANCE", durationValue: round(totalMiles * 0.7, 2), paceZone: "tempo" },
    { title: "Cooldown", durationType: "DISTANCE", durationValue: round(totalMiles * 0.15, 2), paceZone: "easy" },
  ];
}

function longRun(
  totalMiles: number,
  _paces: TrainingPaces
): SegmentDescriptor[] {
  return [
    {
      title: "Long Run",
      durationType: "DISTANCE",
      durationValue: round(totalMiles, 2),
      paceZone: "longRun",
    },
  ];
}

function intervals(
  totalMiles: number,
  _paces: TrainingPaces
): SegmentDescriptor[] {
  const warmupMiles = round(totalMiles * 0.15, 2);
  const cooldownMiles = round(totalMiles * 0.15, 2);
  const middleMiles = round(totalMiles - warmupMiles - cooldownMiles, 2);
  const numReps = 6;
  const intervalMiles = M800;
  const recoveryMiles = M400;
  const reps: SegmentDescriptor[] = [];
  for (let i = 0; i < numReps; i++) {
    reps.push({
      title: "Interval",
      durationType: "DISTANCE",
      durationValue: round(intervalMiles, 2),
      paceZone: "interval",
    });
    reps.push({
      title: "Recovery",
      durationType: "DISTANCE",
      durationValue: round(recoveryMiles, 2),
      paceZone: "recovery",
    });
  }
  return [
    { title: "Warmup", durationType: "DISTANCE", durationValue: warmupMiles, paceZone: "easy" },
    ...reps,
    { title: "Cooldown", durationType: "DISTANCE", durationValue: cooldownMiles, paceZone: "easy" },
  ];
}

const TEMPLATES: Record<string, (totalMiles: number, paces: TrainingPaces) => SegmentDescriptor[]> = {
  Easy: easy,
  Tempo: tempo,
  LongRun: longRun,
  Intervals: intervals,
};

export type WorkoutTypeKey = keyof typeof TEMPLATES;

export function getTemplateSegments(
  workoutType: string,
  totalMiles: number,
  paces: TrainingPaces
): SegmentDescriptor[] {
  const key = workoutType in TEMPLATES ? workoutType : "Easy";
  const fn = TEMPLATES[key as WorkoutTypeKey] ?? easy;
  return fn(totalMiles, paces);
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/** Convert segment descriptor to API segment shape with targets in sec/km */
export interface ApiSegment {
  stepOrder: number;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  targets?: Array<{ type: string; valueLow?: number; valueHigh?: number }>;
  repeatCount?: number;
}

export function descriptorsToApiSegments(
  descriptors: SegmentDescriptor[],
  paces: TrainingPaces
): ApiSegment[] {
  const zoneToSecPerMile = (zone: PaceZone): number => {
    switch (zone) {
      case "easy":
        return paces.easy;
      case "longRun":
        return paces.longRun;
      case "marathon":
        return paces.marathon;
      case "tempo":
        return paces.tempo;
      case "interval":
        return paces.interval;
      case "speed":
        return paces.speed;
      case "recovery":
        return paces.recovery;
      default:
        return paces.easy;
    }
  };

  return descriptors.map((d, i) => {
    const secPerMile = zoneToSecPerMile(d.paceZone);
    const target = paceTargetFromSecondsPerMile(secPerMile);
    return {
      stepOrder: i + 1,
      title: d.title,
      durationType: d.durationType,
      durationValue: d.durationValue,
      targets: [target],
      repeatCount: d.repeatCount,
    };
  });
}
