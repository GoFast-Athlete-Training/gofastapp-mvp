/**
 * Deterministic parse for coach prose pastes (before OpenAI fallback).
 * Handles N×minutes and N×distance reps with effort labels (tempo, 5K, etc.).
 */

import type { WorkoutStep } from "@/lib/training/prescription";
import {
  parsePaceToSecondsPerMile,
  paceTargetFromSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";

const METERS_TO_MILES = 1 / 1609.34;

export type ParsedPasteSegment = {
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  repeatCount?: number;
  /** Sec/mi vs athlete 5K anchor; omit targets when null or no anchor on materialize. */
  paceOffsetSecPerMile?: number | null;
};

export type ParsedPasteWorkout = {
  segments: ParsedPasteSegment[];
  suggestedTitle: string;
  suggestedDescription: string;
};

type ScanMatch = {
  index: number;
  durationType: "DISTANCE" | "TIME";
  repeatCount: number;
  durationValue: number;
  /** Text immediately after the rep prescription (excludes later blocks). */
  effortContext: string;
};

/** Effort labels for this rep only — stop before the next prescription clause. */
function localEffortContext(text: string, matchIndex: number, matchLength: number): string {
  const after = text.slice(matchIndex + matchLength, matchIndex + matchLength + 72);
  const stop = after.search(/\bfollowed by\b|\bthen\b|\band then\b|;\s*|\(\s*\d+\s*[x×]/i);
  const tail = stop >= 0 ? after.slice(0, stop) : after;
  return `${text.slice(matchIndex, matchIndex + matchLength)} ${tail}`.trim();
}

export function effortTextToPaceOffsetSecPerMile(text: string): number | null {
  const t = text.toLowerCase();
  if (/\b5\s*k\b|\b5k\b/.test(t)) return 0;
  if (/\b10\s*k\b|\b10k\b/.test(t)) return 15;
  if (/\btempo\b|\bthreshold\b/.test(t)) return 15;
  if (/\bmarathon\b|\bmp\b/.test(t)) return 45;
  if (/\binterval\b|\bspeed\b/.test(t)) return -10;
  return null;
}

function metersToMiles(meters: number): number {
  return Math.round(meters * METERS_TO_MILES * 1000) / 1000;
}

function titleForSegment(
  durationType: "DISTANCE" | "TIME",
  context: string,
  offset: number | null
): string {
  const t = context.toLowerCase();
  if (/\btempo\b|\bthreshold\b/.test(t)) return "Tempo";
  if (/\b5\s*k\b|\b5k\b/.test(t)) return "Intervals";
  if (durationType === "TIME") return "Tempo";
  if (offset === -10 || /\binterval\b|\bspeed\b/.test(t)) return "Intervals";
  return "Work";
}

function scanPrescriptionMatches(text: string): ScanMatch[] {
  const matches: ScanMatch[] = [];

  const timeRe = /(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:minutes|minute|mins|min)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = timeRe.exec(text)) !== null) {
    const repeatCount = parseInt(m[1], 10);
    const minutes = parseFloat(m[2]);
    if (!Number.isFinite(repeatCount) || repeatCount < 1 || !Number.isFinite(minutes) || minutes <= 0) {
      continue;
    }
    matches.push({
      index: m.index,
      durationType: "TIME",
      repeatCount,
      durationValue: minutes,
      effortContext: localEffortContext(text, m.index, m[0].length),
    });
  }

  const distRe =
    /(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(m\b|meter|meters|mi\b|mile|miles|km\b)/gi;
  while ((m = distRe.exec(text)) !== null) {
    const repeatCount = parseInt(m[1], 10);
    const amount = parseFloat(m[2]);
    const unit = (m[3] || "m").toLowerCase();
    if (!Number.isFinite(repeatCount) || repeatCount < 1 || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    let miles: number;
    if (unit === "mi" || unit === "mile" || unit === "miles") {
      miles = amount;
    } else if (unit === "km") {
      miles = Math.round((amount / 1.60934) * 1000) / 1000;
    } else {
      miles = metersToMiles(amount);
    }
    matches.push({
      index: m.index,
      durationType: "DISTANCE",
      repeatCount,
      durationValue: miles,
      effortContext: localEffortContext(text, m.index, m[0].length),
    });
  }

  matches.sort((a, b) => a.index - b.index);
  return matches;
}

/**
 * Returns structured segments when prose contains at least one N×duration prescription.
 */
export function tryParsePastedWorkoutText(
  sourceText: string,
  workoutTypeHint: string = "Easy"
): ParsedPasteWorkout | null {
  const text = sourceText.trim();
  if (!text) return null;

  const raw = scanPrescriptionMatches(text);
  if (raw.length === 0) return null;

  const segments: ParsedPasteSegment[] = raw.map((hit) => {
    const offset = effortTextToPaceOffsetSecPerMile(hit.effortContext);
    return {
      title: titleForSegment(hit.durationType, hit.effortContext, offset),
      durationType: hit.durationType,
      durationValue: hit.durationValue,
      repeatCount: hit.repeatCount > 1 ? hit.repeatCount : undefined,
      paceOffsetSecPerMile: offset,
    };
  });

  const summary = text.replace(/\s+/g, " ").slice(0, 160);
  const hasTempo = segments.some((s) => s.title === "Tempo" || s.durationType === "TIME");
  const hasIntervals = segments.some((s) => s.title === "Intervals");
  let suggestedTitle = "Parsed workout";
  if (hasTempo && hasIntervals) suggestedTitle = "Tempo + intervals";
  else if (hasTempo || workoutTypeHint === "Tempo") suggestedTitle = "Tempo workout";
  else if (hasIntervals || workoutTypeHint === "Intervals") suggestedTitle = "Track intervals";

  return {
    segments,
    suggestedTitle,
    suggestedDescription: summary,
  };
}

/** Turn parsed paste rows into API workout steps with optional 5K-resolved pace bands. */
export function materializeParsedPasteWorkoutSteps(
  parsed: ParsedPasteWorkout,
  fiveKPaceDisplay: string | null | undefined
): WorkoutStep[] {
  let anchorSec: number | null = null;
  const paceStr = fiveKPaceDisplay?.trim();
  if (paceStr) {
    try {
      anchorSec = parsePaceToSecondsPerMile(paceStr);
    } catch {
      anchorSec = null;
    }
  }

  return parsed.segments.map((seg, i) => {
    let targets: WorkoutStep["targets"];
    if (
      seg.paceOffsetSecPerMile != null &&
      Number.isFinite(seg.paceOffsetSecPerMile) &&
      anchorSec != null
    ) {
      const centerSec = Math.max(1, anchorSec + seg.paceOffsetSecPerMile);
      targets = [paceTargetFromSecondsPerMile(centerSec)];
    }

    return {
      stepOrder: i + 1,
      title: seg.title,
      durationType: seg.durationType,
      durationValue: seg.durationValue,
      repeatCount: seg.repeatCount,
      targets,
    };
  });
}

export function parsedPasteToAiGenerateResponse(
  parsed: ParsedPasteWorkout,
  fiveKPaceDisplay: string | null | undefined
): {
  segments: WorkoutStep[];
  suggestedTitle: string;
  suggestedDescription: string;
} {
  return {
    segments: materializeParsedPasteWorkoutSteps(parsed, fiveKPaceDisplay),
    suggestedTitle: parsed.suggestedTitle,
    suggestedDescription: parsed.suggestedDescription,
  };
}
