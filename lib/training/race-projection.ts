/**
 * Race projection + endurance-aware readiness — shared by hydrate, web, and mobile.
 */

import { metersToMiles } from "@/lib/pace-utils";
import { parsePaceToSecondsPerMile, parseRaceTimeToSeconds } from "@/lib/workout-generator/pace-calculator";

export const MILES_5K_RIEGEL = 3.10686;
/** Half marathon and longer — need sustained long-effort evidence before finish verdicts. */
export const LONG_RACE_MILES_THRESHOLD = 13.109375;
export const MIN_LONG_EFFORT_MILES = 10;
export const HALF_HOLD_MILES_MIN = 12.5;
export const RIEGEL_EXPONENT = 1.06;

export type RacePredictorConfidence = "none" | "low" | "medium" | "high";

export type LongEffortEvidenceSummary = {
  activityId: string;
  activityName: string | null;
  startTime: string | null;
  distanceMiles: number;
  durationSeconds: number;
  avgPaceSecPerMile: number;
  avgPace: string;
  tier: "short" | "long_run" | "half_hold" | "extended_long";
};

export type RaceReadinessPrediction = {
  confidence: RacePredictorConfidence;
  requiresEnduranceEvidence: boolean;
  readinessLabel: string | null;
  gapLabel: string | null;
  estimatedFinish: string | null;
  estimatedFinishSec: number | null;
  estimatedPace: string | null;
  estimatedPaceSecPerMile: number | null;
  finishDeltaSec: number | null;
  onTrack: boolean | null;
  modelFinishFrom5k: string | null;
  modelFinishFrom5kSec: number | null;
  evidence: LongEffortEvidenceSummary | null;
  fitnessGapSecPerMile: number | null;
  fitnessGapLabel: string | null;
};

export function parsePaceStringToSecPerMile(pace: string | null | undefined): number | null {
  const raw = pace?.trim();
  if (!raw) return null;
  try {
    const sec = parsePaceToSecondsPerMile(raw);
    return Number.isFinite(sec) && sec > 0 ? sec : null;
  } catch {
    return null;
  }
}

export function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const rounded = Math.round(sec);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatFinishClock(totalSec: number): string {
  const rounded = Math.max(0, Math.round(totalSec));
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseGoalTimeToSeconds(goalTime: string | null | undefined): number | null {
  const raw = goalTime?.trim();
  if (!raw) return null;
  try {
    const sec = parseRaceTimeToSeconds(raw);
    return Number.isFinite(sec) && sec > 0 ? sec : null;
  } catch {
    return null;
  }
}

/** Project race finish + avg pace from current 5K pace (sec/mi) at event distance. */
export function projectRaceFromFiveKSecPerMile(
  fiveKSecPerMile: number,
  eventMiles: number
): {
  projectedFinishSec: number;
  projectedFinish: string;
  projectedPaceSecPerMile: number;
  projectedPace: string;
} | null {
  if (!Number.isFinite(fiveKSecPerMile) || fiveKSecPerMile <= 0) return null;
  if (!Number.isFinite(eventMiles) || eventMiles <= 0) return null;

  const fiveKSec = fiveKSecPerMile * MILES_5K_RIEGEL;
  const projSec = Math.round(fiveKSec * Math.pow(eventMiles / MILES_5K_RIEGEL, 1.06));
  const paceSecPerMile = Math.round(projSec / eventMiles);

  return {
    projectedFinishSec: projSec,
    projectedFinish: formatFinishClock(projSec),
    projectedPaceSecPerMile: paceSecPerMile,
    projectedPace: formatSecPerMile(paceSecPerMile) ?? "",
  };
}

export function projectRaceFromFiveKPaceString(
  fiveKPaceStr: string | null | undefined,
  eventMiles: number
): ReturnType<typeof projectRaceFromFiveKSecPerMile> {
  const sec = parsePaceStringToSecPerMile(fiveKPaceStr);
  if (sec == null) return null;
  return projectRaceFromFiveKSecPerMile(sec, eventMiles);
}

export function raceDistanceMilesFromRegistry(distanceMeters: number | null | undefined): number | null {
  if (distanceMeters == null || !Number.isFinite(Number(distanceMeters))) return null;
  const miles = metersToMiles(Number(distanceMeters));
  return miles > 0 ? miles : null;
}

export function requiresEnduranceEvidence(eventMiles: number | null | undefined): boolean {
  return eventMiles != null && Number.isFinite(eventMiles) && eventMiles >= LONG_RACE_MILES_THRESHOLD;
}

/** Project finish at target distance from a sustained effort at known distance + pace. */
export function projectRaceFromEffortSecPerMile(
  effortPaceSecPerMile: number,
  effortMiles: number,
  eventMiles: number
): ReturnType<typeof projectRaceFromFiveKSecPerMile> {
  if (!Number.isFinite(effortPaceSecPerMile) || effortPaceSecPerMile <= 0) return null;
  if (!Number.isFinite(effortMiles) || effortMiles <= 0) return null;
  if (!Number.isFinite(eventMiles) || eventMiles <= 0) return null;

  const effortFinishSec = effortPaceSecPerMile * effortMiles;
  const projSec = Math.round(
    effortFinishSec * Math.pow(eventMiles / effortMiles, RIEGEL_EXPONENT)
  );
  const paceSecPerMile = Math.round(projSec / eventMiles);

  return {
    projectedFinishSec: projSec,
    projectedFinish: formatFinishClock(projSec),
    projectedPaceSecPerMile: paceSecPerMile,
    projectedPace: formatSecPerMile(paceSecPerMile) ?? "",
  };
}

export function confidenceFromEvidence(
  evidence: LongEffortEvidenceSummary | null | undefined
): RacePredictorConfidence {
  if (!evidence) return "none";
  if (evidence.tier === "extended_long") return "high";
  if (evidence.tier === "half_hold") return "medium";
  if (evidence.tier === "long_run") return "low";
  return "none";
}

export function longEffortTierFromMiles(miles: number): LongEffortEvidenceSummary["tier"] {
  if (miles >= 16) return "extended_long";
  if (miles >= HALF_HOLD_MILES_MIN) return "half_hold";
  if (miles >= MIN_LONG_EFFORT_MILES) return "long_run";
  return "short";
}

/** Build evidence summary from a synced run (client-safe). */
export function buildLongEffortEvidenceFromRun(params: {
  activityId: string;
  activityName: string | null;
  startTime: string | null;
  distanceMiles: number;
  durationSeconds: number;
}): LongEffortEvidenceSummary | null {
  const { activityId, activityName, startTime, distanceMiles, durationSeconds } = params;
  if (!Number.isFinite(distanceMiles) || distanceMiles < MIN_LONG_EFFORT_MILES) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  const avgPaceSecPerMile = Math.round(durationSeconds / distanceMiles);
  if (!Number.isFinite(avgPaceSecPerMile) || avgPaceSecPerMile <= 0) return null;

  return {
    activityId,
    activityName,
    startTime,
    distanceMiles,
    durationSeconds,
    avgPaceSecPerMile,
    avgPace: formatSecPerMile(avgPaceSecPerMile) ?? "",
    tier: longEffortTierFromMiles(distanceMiles),
  };
}

function triangulationWeights(
  confidence: RacePredictorConfidence
): { fiveK: number; long: number } | null {
  switch (confidence) {
    case "low":
      return { fiveK: 0.45, long: 0.55 };
    case "medium":
      return { fiveK: 0.35, long: 0.65 };
    case "high":
      return { fiveK: 0.25, long: 0.75 };
    default:
      return null;
  }
}

function triangulateFinishSec(
  fiveKProjSec: number | null,
  longProjSec: number | null,
  confidence: RacePredictorConfidence
): number | null {
  if (fiveKProjSec == null && longProjSec == null) return null;
  if (confidence === "none" || longProjSec == null) return null;
  if (fiveKProjSec == null) return longProjSec;

  const weights = triangulationWeights(confidence);
  if (!weights) return null;
  return Math.round(fiveKProjSec * weights.fiveK + longProjSec * weights.long);
}

function formatFinishDeltaLabel(finishDeltaSec: number): string {
  const abs = Math.abs(finishDeltaSec);
  const min = Math.floor(abs / 60);
  const sec = abs % 60;
  const clock = min > 0 ? `${min}:${String(sec).padStart(2, "0")}` : `${sec}s`;
  if (finishDeltaSec > 0) return `${clock} ahead of goal`;
  if (finishDeltaSec < 0) return `${clock} behind goal`;
  return "On goal pace";
}

function formatFitnessGapLabel(gapSecPerMile: number): string {
  const abs = Math.abs(Math.round(gapSecPerMile));
  if (gapSecPerMile < 0) return `${abs}s/mi faster than goal 5K fitness`;
  if (gapSecPerMile > 0) return `${abs}s/mi from goal 5K fitness`;
  return "On goal 5K fitness";
}

function confidencePrefix(confidence: RacePredictorConfidence): string {
  switch (confidence) {
    case "high":
      return "Strong estimate";
    case "medium":
      return "Estimate";
    case "low":
      return "Early estimate";
    default:
      return "Estimate";
  }
}

function evidenceDescriptor(evidence: LongEffortEvidenceSummary): string {
  const miles = evidence.distanceMiles.toFixed(1);
  if (evidence.tier === "half_hold" || evidence.tier === "extended_long") {
    return `${miles} mi hold + 5K fitness`;
  }
  return `${miles} mi long run + 5K fitness`;
}

const EMPTY_READINESS: RaceReadinessPrediction = {
  confidence: "none",
  requiresEnduranceEvidence: false,
  readinessLabel: null,
  gapLabel: null,
  estimatedFinish: null,
  estimatedFinishSec: null,
  estimatedPace: null,
  estimatedPaceSecPerMile: null,
  finishDeltaSec: null,
  onTrack: null,
  modelFinishFrom5k: null,
  modelFinishFrom5kSec: null,
  evidence: null,
  fitnessGapSecPerMile: null,
  fitnessGapLabel: null,
};

/**
 * Endurance-aware race readiness: triangulates 5K fitness with recent long-effort evidence
 * for half+ distances; short races still use 5K projection only.
 */
export function computeRaceReadiness(params: {
  current5kSecPerMile: number | null;
  goalFinishSec: number | null;
  goalPaceSecPerMile: number | null;
  goalPace5KSecPerMile: number | null;
  eventMiles: number | null;
  evidence: LongEffortEvidenceSummary | null;
}): RaceReadinessPrediction {
  const {
    current5kSecPerMile,
    goalFinishSec,
    goalPaceSecPerMile,
    goalPace5KSecPerMile,
    eventMiles,
    evidence,
  } = params;

  if (eventMiles == null || !Number.isFinite(eventMiles) || eventMiles <= 0) {
    return { ...EMPTY_READINESS };
  }

  const needsEndurance = requiresEnduranceEvidence(eventMiles);
  const confidence = needsEndurance ? confidenceFromEvidence(evidence) : "high";

  let fitnessGapSecPerMile: number | null = null;
  let fitnessGapLabel: string | null = null;
  if (
    current5kSecPerMile != null &&
    goalPace5KSecPerMile != null &&
    goalPace5KSecPerMile > 0
  ) {
    fitnessGapSecPerMile = current5kSecPerMile - goalPace5KSecPerMile;
    fitnessGapLabel = formatFitnessGapLabel(fitnessGapSecPerMile);
  }

  const fiveKProjection =
    current5kSecPerMile != null
      ? projectRaceFromFiveKSecPerMile(current5kSecPerMile, eventMiles)
      : null;

  const modelFinishFrom5k = fiveKProjection?.projectedFinish ?? null;
  const modelFinishFrom5kSec = fiveKProjection?.projectedFinishSec ?? null;

  if (!needsEndurance) {
    const diff = differenceToGoal({
      goalFinishSec,
      projectedFinishSec: fiveKProjection?.projectedFinishSec ?? null,
      goalPaceSecPerMile,
      projectedPaceSecPerMile: fiveKProjection?.projectedPaceSecPerMile ?? null,
    });

    return {
      confidence: current5kSecPerMile != null ? "high" : "none",
      requiresEnduranceEvidence: false,
      readinessLabel: diff.finishDeltaLabel ?? diff.paceDeltaLabel ?? fitnessGapLabel,
      gapLabel: diff.finishDeltaLabel ?? diff.paceDeltaLabel ?? fitnessGapLabel,
      estimatedFinish: fiveKProjection?.projectedFinish ?? null,
      estimatedFinishSec: fiveKProjection?.projectedFinishSec ?? null,
      estimatedPace: fiveKProjection?.projectedPace ?? null,
      estimatedPaceSecPerMile: fiveKProjection?.projectedPaceSecPerMile ?? null,
      finishDeltaSec: diff.finishDeltaSec,
      onTrack: diff.onTrack,
      modelFinishFrom5k,
      modelFinishFrom5kSec,
      evidence: null,
      fitnessGapSecPerMile,
      fitnessGapLabel,
    };
  }

  if (confidence === "none") {
    const readinessLabel =
      "Need a recent long effort (10+ mi) before we can estimate marathon readiness.";
    return {
      confidence: "none",
      requiresEnduranceEvidence: true,
      readinessLabel,
      gapLabel: fitnessGapLabel ?? readinessLabel,
      estimatedFinish: null,
      estimatedFinishSec: null,
      estimatedPace: null,
      estimatedPaceSecPerMile: null,
      finishDeltaSec: null,
      onTrack: null,
      modelFinishFrom5k,
      modelFinishFrom5kSec,
      evidence,
      fitnessGapSecPerMile,
      fitnessGapLabel,
    };
  }

  const longProjection =
    evidence != null
      ? projectRaceFromEffortSecPerMile(
          evidence.avgPaceSecPerMile,
          evidence.distanceMiles,
          eventMiles
        )
      : null;

  const estimatedFinishSec = triangulateFinishSec(
    fiveKProjection?.projectedFinishSec ?? null,
    longProjection?.projectedFinishSec ?? null,
    confidence
  );

  const estimatedPaceSecPerMile =
    estimatedFinishSec != null ? Math.round(estimatedFinishSec / eventMiles) : null;

  let finishDeltaSec: number | null = null;
  let gapLabel: string | null = null;
  let onTrack: boolean | null = null;

  if (goalFinishSec != null && estimatedFinishSec != null) {
    finishDeltaSec = goalFinishSec - estimatedFinishSec;
    const deltaLabel = formatFinishDeltaLabel(finishDeltaSec);
    gapLabel = `${confidencePrefix(confidence)} · ${deltaLabel} (${evidenceDescriptor(evidence!)})`;
    onTrack = finishDeltaSec >= 0;
  } else if (fitnessGapLabel) {
    gapLabel = `${confidencePrefix(confidence)} · ${fitnessGapLabel}`;
  }

  const readinessLabel =
    gapLabel ??
    `${confidencePrefix(confidence)} based on ${evidenceDescriptor(evidence!)}`;

  return {
    confidence,
    requiresEnduranceEvidence: true,
    readinessLabel,
    gapLabel,
    estimatedFinish:
      estimatedFinishSec != null ? formatFinishClock(estimatedFinishSec) : null,
    estimatedFinishSec,
    estimatedPace: formatSecPerMile(estimatedPaceSecPerMile),
    estimatedPaceSecPerMile,
    finishDeltaSec,
    onTrack,
    modelFinishFrom5k,
    modelFinishFrom5kSec,
    evidence,
    fitnessGapSecPerMile,
    fitnessGapLabel,
  };
}

export type GoalDifference = {
  finishDeltaSec: number | null;
  finishDeltaLabel: string | null;
  paceDeltaSecPerMile: number | null;
  paceDeltaLabel: string | null;
  /** positive = projected faster than goal */
  onTrack: boolean | null;
};

export function differenceToGoal(params: {
  goalFinishSec: number | null;
  projectedFinishSec: number | null;
  goalPaceSecPerMile: number | null;
  projectedPaceSecPerMile: number | null;
}): GoalDifference {
  const { goalFinishSec, projectedFinishSec, goalPaceSecPerMile, projectedPaceSecPerMile } =
    params;

  let finishDeltaSec: number | null = null;
  let finishDeltaLabel: string | null = null;
  if (goalFinishSec != null && projectedFinishSec != null) {
    finishDeltaSec = goalFinishSec - projectedFinishSec;
    const abs = Math.abs(finishDeltaSec);
    const min = Math.floor(abs / 60);
    const sec = abs % 60;
    const clock = min > 0 ? `${min}:${String(sec).padStart(2, "0")}` : `${sec}s`;
    finishDeltaLabel =
      finishDeltaSec > 0
        ? `${clock} ahead of goal`
        : finishDeltaSec < 0
          ? `${clock} behind goal`
          : "On goal pace";
  }

  let paceDeltaSecPerMile: number | null = null;
  let paceDeltaLabel: string | null = null;
  if (goalPaceSecPerMile != null && projectedPaceSecPerMile != null) {
    paceDeltaSecPerMile = goalPaceSecPerMile - projectedPaceSecPerMile;
    const abs = Math.abs(paceDeltaSecPerMile);
    paceDeltaLabel =
      paceDeltaSecPerMile > 0
        ? `${abs}s/mi faster than goal`
        : paceDeltaSecPerMile < 0
          ? `${abs}s/mi slower than goal`
          : "On goal pace";
  }

  const onTrack =
    finishDeltaSec != null
      ? finishDeltaSec >= 0
      : paceDeltaSecPerMile != null
        ? paceDeltaSecPerMile >= 0
        : null;

  return {
    finishDeltaSec,
    finishDeltaLabel,
    paceDeltaSecPerMile,
    paceDeltaLabel,
    onTrack,
  };
}
