/**
 * Athlete start → variable base-build bridge → fixed build-to-peak block.
 * Preset min weekly miles is not a floor. Taper and race week stay outside this module.
 */

export const LONG_RUN_OF_WEEKLY = 0.3;
export const INJURY_START_FACTOR = 0.75;
export const MAX_LONG_RUN_STEP_MILES = 2;
export const MAX_WEEKLY_STEP_RATIO = 0.1;
export const DEFAULT_LONG_RUN_CUTBACK = 0.2;

export type AthleteStartInput = {
  currentWeeklyMileage?: number | null;
  athleteWeeklyMileage?: number | null;
  avgWeeklyMilesSnapshot?: number | null;
  longRunCapabilityMiles?: number | null;
  returningFromInjury?: boolean;
};

export type ResolvedAthleteStart = {
  weeklyMiles: number | null;
  longRunMiles: number | null;
  missingData: boolean;
  derived: boolean;
  returningFromInjury: boolean;
};

export type FoundationBuildPlan = {
  longRunByWeek: Map<number, number>;
  weeklyByWeek: Map<number, number>;
  missingData: boolean;
  derived: boolean;
  unrealistic: boolean;
  entryLongRunMiles: number;
  entryWeeklyMiles: number;
  peakLongRunMiles: number;
  peakWeeklyMiles: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function positive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function effectiveCutback(raw: number | null | undefined): number {
  if (raw != null && Number.isFinite(raw) && raw > 0 && raw < 1) return raw;
  return DEFAULT_LONG_RUN_CUTBACK;
}

/** 0-based indexes inside a peak block that are deliberate cutbacks. */
export function peakBlockCutbackIndexes(weekCount: number): number[] {
  const n = Math.max(0, Math.floor(weekCount));
  if (n <= 2) return [];
  if (n < 6) return [n - 2];
  const mid = Math.floor(n / 2) - 1;
  const beforePeak = n - 2;
  if (mid > 0 && mid !== beforePeak) return [mid, beforePeak];
  return [beforePeak];
}

/**
 * Build-to-peak miles. Last week is the peak. An 8-week block cuts back on weeks 4 and 7.
 */
export function peakBlockSeries(
  weekCount: number,
  start: number,
  peak: number,
  cutback: number,
): number[] {
  const n = Math.max(0, Math.floor(weekCount));
  if (n === 0) return [];
  const hi = round1(Math.max(start, peak));
  const lo = round1(Math.min(start, hi));
  if (n === 1) return [hi];
  if (lo >= hi) return Array.from({ length: n }, () => hi);

  const cuts = new Set(peakBlockCutbackIndexes(n));
  const climb: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    if (!cuts.has(i)) climb.push(i);
  }
  const out: number[] = new Array(n);
  out[n - 1] = hi;
  climb.forEach((idx, k) => {
    const t = (k + 1) / (climb.length + 1);
    out[idx] = round1(lo + (hi - lo) * t);
  });
  for (let i = 0; i < n; i++) {
    if (!cuts.has(i)) continue;
    const prev = i > 0 ? out[i - 1]! : lo;
    out[i] = round1(prev * (1 - cutback));
  }
  return out;
}

function bridgeSeries(count: number, from: number, to: number): number[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const start = round1(from);
  const end = round1(to);
  if (start >= end) return Array.from({ length: n }, () => start);
  return Array.from({ length: n }, (_, i) => round1(start + (end - start) * ((i + 1) / n)));
}

function longRunStepTooSteep(values: number[], skip: Set<number>): boolean {
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (skip.has(i)) continue;
    const v = values[i]!;
    if (prev != null && v - prev > MAX_LONG_RUN_STEP_MILES + 0.05) return true;
    prev = v;
  }
  return false;
}

function weeklyStepTooSteep(values: number[], skip: Set<number>): boolean {
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (skip.has(i)) continue;
    const v = values[i]!;
    if (prev != null && prev > 0 && (v - prev) / prev > MAX_WEEKLY_STEP_RATIO + 1e-6) return true;
    prev = v;
  }
  return false;
}

export function resolveAthleteStart(input: AthleteStartInput): ResolvedAthleteStart {
  let weekly =
    positive(input.currentWeeklyMileage) ??
    positive(input.athleteWeeklyMileage) ??
    positive(input.avgWeeklyMilesSnapshot);
  let longRun = positive(input.longRunCapabilityMiles);
  const missingData = weekly == null && longRun == null;
  let derived = false;
  if (weekly != null && longRun == null) {
    longRun = round1(weekly * LONG_RUN_OF_WEEKLY);
    derived = true;
  } else if (weekly == null && longRun != null) {
    weekly = round1(longRun / LONG_RUN_OF_WEEKLY);
    derived = true;
  }
  const returningFromInjury = input.returningFromInjury === true;
  if (returningFromInjury) {
    if (weekly != null) weekly = round1(weekly * INJURY_START_FACTOR);
    if (longRun != null) longRun = round1(longRun * INJURY_START_FACTOR);
  }
  return {
    weeklyMiles: weekly,
    longRunMiles: longRun,
    missingData,
    derived,
    returningFromInjury,
  };
}

export function planFoundationBuild(params: {
  holdWeekNumbers: number[];
  rampWeekNumbers: number[];
  athlete: ResolvedAthleteStart;
  /** Build-to-peak entry long run (`build.startLongRunMiles`). */
  entryLongRunMiles: number | null;
  peakLongRunMiles: number | null;
  /** Base-build peak weekly when that phase is linked; otherwise derived. */
  entryWeeklyMiles: number | null;
  peakWeeklyMiles: number | null;
  longRunCutback: number | null;
}): FoundationBuildPlan {
  const entryLong = positive(params.entryLongRunMiles) ?? 8;
  const peakLong = Math.max(entryLong, positive(params.peakLongRunMiles) ?? 20);
  const peakWeeklyRaw = positive(params.peakWeeklyMiles) ?? 40;
  const entryWeekly =
    positive(params.entryWeeklyMiles) ??
    round1(peakWeeklyRaw * (entryLong / peakLong));
  const peakWeekly = Math.max(entryWeekly, peakWeeklyRaw);
  const cutback = effectiveCutback(params.longRunCutback);

  const missingData = params.athlete.missingData;
  let startLong = params.athlete.longRunMiles ?? entryLong;
  let startWeekly = params.athlete.weeklyMiles ?? entryWeekly;
  startLong = Math.min(startLong, peakLong);
  startWeekly = Math.min(startWeekly, peakWeekly);

  const hold = [...params.holdWeekNumbers].sort((a, b) => a - b);
  const ramp = [...params.rampWeekNumbers].sort((a, b) => a - b);

  const longRunTarget = Math.min(Math.max(startLong, entryLong), peakLong);
  const weeklyTarget = Math.min(Math.max(startWeekly, entryWeekly), peakWeekly);
  const holdLong = bridgeSeries(
    hold.length,
    startLong,
    startLong >= entryLong ? startLong : longRunTarget,
  );
  const holdWeekly = bridgeSeries(
    hold.length,
    startWeekly,
    startWeekly >= entryWeekly ? startWeekly : weeklyTarget,
  );

  const arrivalLong = holdLong.length > 0 ? holdLong[holdLong.length - 1]! : startLong;
  const arrivalWeekly = holdWeekly.length > 0 ? holdWeekly[holdWeekly.length - 1]! : startWeekly;
  const rampLong = peakBlockSeries(ramp.length, arrivalLong, peakLong, cutback);
  const rampWeekly = peakBlockSeries(ramp.length, arrivalWeekly, peakWeekly, cutback);

  const longRunByWeek = new Map<number, number>();
  const weeklyByWeek = new Map<number, number>();
  hold.forEach((week, i) => {
    longRunByWeek.set(week, holdLong[i]!);
    weeklyByWeek.set(week, round2(holdWeekly[i]!));
  });
  ramp.forEach((week, i) => {
    longRunByWeek.set(week, rampLong[i]!);
    weeklyByWeek.set(week, round2(rampWeekly[i]!));
  });

  const rampCuts = new Set(peakBlockCutbackIndexes(ramp.length));
  const unrealistic =
    longRunStepTooSteep(holdLong, new Set()) ||
    weeklyStepTooSteep(holdWeekly, new Set()) ||
    longRunStepTooSteep(rampLong, rampCuts) ||
    weeklyStepTooSteep(rampWeekly, rampCuts);

  return {
    longRunByWeek,
    weeklyByWeek,
    missingData,
    derived: params.athlete.derived,
    unrealistic,
    entryLongRunMiles: entryLong,
    entryWeeklyMiles: entryWeekly,
    peakLongRunMiles: peakLong,
    peakWeeklyMiles: peakWeekly,
  };
}
