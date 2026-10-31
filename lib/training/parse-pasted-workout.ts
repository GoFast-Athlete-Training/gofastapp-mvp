/**
 * Deterministic parse for coach prose pastes (before OpenAI fallback).
 * Handles N×minutes and N×distance reps with effort labels (tempo, 5K, etc.).
 */

import type { WorkoutStep } from "@/lib/training/prescription";
import {
  parsePaceToSecondsPerMile,
  paceTargetFromSecondsPerMile,
  secondsPerMileToSecondsPerKm,
} from "@/lib/workout-generator/pace-calculator";

const METERS_TO_MILES = 1 / 1609.34;

export type ParsedPasteSegment = {
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  repeatCount?: number;
  /** Sec/mi vs athlete 5K anchor; omit targets when null or no anchor on materialize. */
  paceOffsetSecPerMile?: number | null;
  recoveryDurationType?: "DISTANCE" | "TIME" | null;
  recoveryDurationValue?: number | null;
  /** Sec/mi vs 5K for between-rep / alternating slow leg when set. */
  recoveryPaceOffsetSecPerMile?: number | null;
  /** Local clause after the rep match — used for pace/recovery parsing at materialize. */
  effortContext?: string;
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
  const after = text.slice(matchIndex + matchLength, matchIndex + matchLength + 140);
  const stop = after.search(/\bfollowed by\b|\bthen\b|\band then\b|;\s*|\(\s*\d+\s*[x×]/i);
  const tail = stop >= 0 ? after.slice(0, stop) : after;
  return `${text.slice(matchIndex, matchIndex + matchLength)} ${tail}`.trim();
}

export type ParsedBetweenRepRecovery = {
  recoveryDurationType: "DISTANCE" | "TIME";
  recoveryDurationValue: number;
};

/** Parse "with 400m jog", "400m easy recovery between repeats", etc. */
export function parseBetweenRepRecoveryFromText(text: string): ParsedBetweenRepRecovery | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const withPattern =
    /(?:w\/|with)\s*(\d+(?:\.\d+)?)\s*(m\b|meter|meters|mi\b|mile|miles|km\b|min(?:ute)?s?)?\s*(?:easy\s*)?(?:jog\s*)?(?:recovery|rest)?(?:\s*between|\s*between\s*repeat)?/i;
  let m = normalized.match(withPattern);

  if (!m) {
    m = normalized.match(
      /(\d+(?:\.\d+)?)\s*(m\b|meter|meters|mi\b|mile|miles|km\b)\s*(?:easy\s*)?(?:jog\s*)?(?:recovery|rest)\s*(?:between|\bbetween\s*repeat)?/i
    );
  }

  if (!m) {
    m = normalized.match(
      /jog\s*([\d,]+(?:\.\d+)?)\s*(m\b|meter|meters|mi\b|mile|miles|km\b)\s*(?:for\s*)?(?:recovery|rest)/i
    );
    if (m) {
      const raw = parseFloat(m[1].replace(/,/g, ""));
      const unit = (m[2] || "m").toLowerCase();
      if (Number.isFinite(raw) && raw > 0) {
        if (unit === "mi" || unit === "mile" || unit === "miles") {
          return { recoveryDurationType: "DISTANCE", recoveryDurationValue: raw };
        }
        if (unit === "km") {
          return {
            recoveryDurationType: "DISTANCE",
            recoveryDurationValue: Math.round((raw / 1.60934) * 1000) / 1000,
          };
        }
        return {
          recoveryDurationType: "DISTANCE",
          recoveryDurationValue: metersToMiles(raw),
        };
      }
    }
  }

  if (!m) {
    m = normalized.match(
      /\/\s*(\d+(?:\.\d+)?)\s*-?\s*(mi\b|mile|miles|km\b|m\b|meter|meters|min(?:ute)?s?)\b/i
    );
  }

  if (!m) return null;

  const raw = parseFloat(m[1]);
  const unit = (m[2] || "m").toLowerCase();
  if (!Number.isFinite(raw) || raw <= 0) return null;

  if (unit.startsWith("min")) {
    return { recoveryDurationType: "TIME", recoveryDurationValue: raw };
  }
  if (unit === "mi" || unit === "mile" || unit === "miles") {
    return { recoveryDurationType: "DISTANCE", recoveryDurationValue: raw };
  }
  if (unit === "km") {
    return {
      recoveryDurationType: "DISTANCE",
      recoveryDurationValue: Math.round((raw / 1.60934) * 1000) / 1000,
    };
  }
  return {
    recoveryDurationType: "DISTANCE",
    recoveryDurationValue: metersToMiles(raw),
  };
}

function parseExplicitPaceBandSecPerMile(context: string): { low: number; high: number } | null {
  const m = context.match(
    /(\d{1,2}:\d{2})\s*[–\-—]\s*(\d{1,2}:\d{2})\s*(?:\/\s*)?(?:mi(?:le)?s?|minutes?\s+per\s+mile)?/i
  );
  if (!m) return null;
  try {
    const a = parsePaceToSecondsPerMile(m[1].trim());
    const b = parsePaceToSecondsPerMile(m[2].trim());
    return { low: Math.min(a, b), high: Math.max(a, b) };
  } catch {
    return null;
  }
}

/** Single clock pace e.g. "at 6:15 minutes per mile". */
function parseExplicitSinglePaceSecPerMile(context: string): number | null {
  const m =
    context.match(
      /(?:at|@)\s*(\d{1,2}:\d{2})\s*(?:minutes?\s+per\s+mile|\/\s*mi\b|per\s+mile)?/i
    ) ?? context.match(/(\d{1,2}:\d{2})\s*minutes?\s+per\s+mile/i);
  if (!m) return null;
  try {
    return parsePaceToSecondsPerMile(m[1].trim());
  } catch {
    return null;
  }
}

function parseExplicitPaceSecPerMile(context: string): { low: number; high: number } | null {
  const band = parseExplicitPaceBandSecPerMile(context);
  if (band) return band;
  const single = parseExplicitSinglePaceSecPerMile(context);
  if (single == null) return null;
  return { low: single, high: single };
}

export function effortTextToPaceOffsetSecPerMile(text: string): number | null {
  const t = text.toLowerCase();
  if (/\b5\s*k\s*(?:race\s*)?pace\b|\b5k\s*(?:race\s*)?pace\b|\b5\s*k\b|\b5k\b/.test(t)) return 0;
  if (/\b10\s*k\b|\b10k\b/.test(t)) return 15;
  if (/\btempo\b|\bthreshold\b/.test(t)) return 15;
  if (/\bmarathon\b|\bmp\b/.test(t)) return 45;
  if (/\binterval\b|\bspeed\b/.test(t)) return -10;
  return null;
}

function metersToMiles(meters: number): number {
  return Math.round(meters * METERS_TO_MILES * 1000) / 1000;
}

/** Rep distance when unit is omitted (e.g. "4 x 2000" → meters; "6 x 2 mile" → miles). */
export function inferRepDistanceMiles(amount: number, unitRaw: string | undefined, effortContext: string): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = unitRaw?.toLowerCase();
  if (unit === "k") {
    return Math.round((amount / 1.60934) * 1000) / 1000;
  }
  if (unit === "km") {
    return Math.round((amount / 1.60934) * 1000) / 1000;
  }
  if (unit === "mi" || unit === "mile" || unit === "miles") {
    return amount;
  }
  if (unit === "m" || unit === "meter" || unit === "meters") {
    return metersToMiles(amount);
  }
  const ctx = effortContext.toLowerCase();
  if (/\b(?:mi|mile|miles)\b/.test(ctx)) {
    return amount;
  }
  if (/\b(?:meter|meters|metres)\b/.test(ctx)) {
    return metersToMiles(amount);
  }
  if (amount >= 200) {
    return metersToMiles(amount);
  }
  return amount;
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
    /(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*-?\s*(k\b|m\b|meter|meters|mi\b|mile|miles|km\b)?(?!\s*-?\s*(?:min(?:ute)?s?)\b)/gi;
  while ((m = distRe.exec(text)) !== null) {
    const repeatCount = parseInt(m[1], 10);
    const amount = parseFloat(m[2]);
    const unitRaw = m[3];
    if (!Number.isFinite(repeatCount) || repeatCount < 1 || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    const effortContext = localEffortContext(text, m.index, m[0].length);
    const miles = inferRepDistanceMiles(amount, unitRaw, effortContext);
    if (miles == null) continue;
    if (matches.some((hit) => hit.index === m!.index)) continue;
    matches.push({
      index: m.index,
      durationType: "DISTANCE",
      repeatCount,
      durationValue: miles,
      effortContext,
    });
  }

  matches.sort((a, b) => a.index - b.index);
  return matches;
}

function parseCommaNumber(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function distanceTokenToMiles(amount: number, unitRaw: string): number | null {
  const unit = unitRaw.toLowerCase();
  if (unit === "mi" || unit === "mile" || unit === "miles") return amount;
  if (unit === "km") return Math.round((amount / 1.60934) * 1000) / 1000;
  if (unit === "m" || unit === "meter" || unit === "meters") return metersToMiles(amount);
  return null;
}

/** Bookends + "8 miles alternating marathon pace and slightly slower" (1 mi / 1 mi pairs). */
function tryParseAlternatingMarathonBlock(text: string): ParsedPasteWorkout | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!/\balternating\b/i.test(normalized)) return null;
  if (!/\b(?:marathon\s*pace|\bmp\b)/i.test(normalized)) return null;

  const workM =
    normalized.match(
      /(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b[^,.]*\balternating/i
    ) ??
    normalized.match(
      /(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b[^,.]*(?:marathon\s*pace|\bmp\b)/i
    );
  if (!workM) return null;
  const workMi = parseFloat(workM[1]);
  if (!Number.isFinite(workMi) || workMi <= 0) return null;

  const bookends = scanBookendSegments(normalized).map((b) => b.segment);
  const warmup = bookends.find((s) => s.title === "Warmup");
  const cooldown = bookends.find((s) => s.title === "Cooldown");

  const pairMi = 2;
  const repeatCount = Math.max(1, Math.round(workMi / pairMi));

  const segments: ParsedPasteSegment[] = [];
  if (warmup) segments.push(warmup);
  segments.push({
    title: "Marathon pace",
    durationType: "DISTANCE",
    durationValue: 1,
    repeatCount,
    paceOffsetSecPerMile: 45,
    recoveryDurationType: "DISTANCE",
    recoveryDurationValue: 1,
    recoveryPaceOffsetSecPerMile: 60,
    effortContext: "1 mile marathon pace, 1 mile slightly slower",
  });
  if (cooldown) segments.push(cooldown);

  const warmupMi = warmup?.durationType === "DISTANCE" ? warmup.durationValue : 0;
  const cooldownMi = cooldown?.durationType === "DISTANCE" ? cooldown.durationValue : 0;
  const totalMi = Math.round((warmupMi + workMi + cooldownMi) * 10) / 10;
  const summary = normalized.slice(0, 160);

  return {
    segments,
    suggestedTitle: `alternating MP - ${totalMi} miles`,
    suggestedDescription: summary,
  };
}

/** Coach block lists: "Block 1: Repeat 3 times:" with Run / Jog bullets. */
function tryParseCoachBlockWorkout(text: string): ParsedPasteWorkout | null {
  if (!/repeat\s+\d+\s+times/i.test(text)) return null;

  const blockRe =
    /Block\s+(\d+):\s*Repeat\s+(\d+)\s+times:?\s*([\s\S]*?)(?=Block\s+\d+\s*:|Cooldown:|$)/gi;
  const segments: ParsedPasteSegment[] = [];
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(text)) !== null) {
    const blockNum = m[1];
    const repeatCount = parseInt(m[2], 10);
    const body = m[3] ?? "";
    if (!Number.isFinite(repeatCount) || repeatCount < 1) continue;

    const runLine = body.match(/Run\s+([\d,][^\n]*)/i)?.[1];
    if (!runLine) continue;

    const distMatch = runLine.match(
      /([\d,]+(?:\.\d+)?)\s*(meters|meter|m\b|mi\b|mile|miles|km\b)/i
    );
    if (!distMatch) continue;
    const amount = parseCommaNumber(distMatch[1]);
    if (amount == null) continue;
    const miles = distanceTokenToMiles(amount, distMatch[2]);
    if (miles == null) continue;

    const effortContext = runLine.trim();
    const offset = effortTextToPaceOffsetSecPerMile(effortContext);
    const recovery =
      repeatCount > 1 ? parseBetweenRepRecoveryFromText(body) : null;

    segments.push({
      title: `Block ${blockNum}`,
      durationType: "DISTANCE",
      durationValue: miles,
      repeatCount: repeatCount > 1 ? repeatCount : undefined,
      paceOffsetSecPerMile: offset,
      recoveryDurationType: recovery?.recoveryDurationType ?? null,
      recoveryDurationValue: recovery?.recoveryDurationValue ?? null,
      effortContext,
    });
  }

  if (segments.length === 0) return null;

  const summary = text.replace(/\s+/g, " ").slice(0, 160);
  return {
    segments,
    suggestedTitle: segments.length > 1 ? "Track workout — blocks" : "Track workout",
    suggestedDescription: summary,
  };
}

function bookendDuration(
  amount: number,
  unitRaw: string
): { durationType: "DISTANCE" | "TIME"; durationValue: number } | null {
  const unit = unitRaw.toLowerCase();
  if (unit.startsWith("min")) {
    return { durationType: "TIME", durationValue: amount };
  }
  const miles = distanceTokenToMiles(amount, unitRaw);
  if (miles == null) return null;
  return { durationType: "DISTANCE", durationValue: miles };
}

/** "3 mile warm up" / "warmup of 2 miles" and the cooldown equivalents. */
function scanBookendSegments(
  text: string
): Array<{ index: number; segment: ParsedPasteSegment }> {
  const specs: Array<{ title: "Warmup" | "Cooldown"; label: string }> = [
    { title: "Warmup", label: "warm[\\s-]?ups?|wu\\b" },
    { title: "Cooldown", label: "cool[\\s-]?downs?|cd\\b" },
  ];
  const unit =
    "minutes|minute|mins|min|miles|mile|mi|kilometers|km|meters|meter|m";
  const out: Array<{ index: number; segment: ParsedPasteSegment }> = [];

  for (const spec of specs) {
    const re = new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*-?\\s*(${unit})\\s+(?:easy\\s+)?(?:${spec.label})|(?:${spec.label})\\s+(?:of\\s+|for\\s+)?(\\d+(?:\\.\\d+)?)\\s*-?\\s*(${unit})`,
      "gi"
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const amount = parseFloat(m[1] ?? m[3] ?? "");
      const unitRaw = m[2] ?? m[4];
      if (!unitRaw || !Number.isFinite(amount) || amount <= 0) continue;
      const dur = bookendDuration(amount, unitRaw);
      if (!dur) continue;
      out.push({
        index: m.index,
        segment: {
          title: spec.title,
          durationType: dur.durationType,
          durationValue: dur.durationValue,
          paceOffsetSecPerMile: null,
          effortContext: m[0],
        },
      });
    }
  }

  return out;
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

  const alternating = tryParseAlternatingMarathonBlock(text);
  if (alternating) return alternating;

  const blockParsed = tryParseCoachBlockWorkout(text);
  if (blockParsed) return blockParsed;

  const raw = scanPrescriptionMatches(text);
  if (raw.length === 0) return null;

  const workPieces: Array<{ index: number; segment: ParsedPasteSegment }> = raw.map((hit) => {
    const offset = effortTextToPaceOffsetSecPerMile(hit.effortContext);
    const recovery =
      hit.repeatCount > 1 ? parseBetweenRepRecoveryFromText(hit.effortContext) : null;
    return {
      index: hit.index,
      segment: {
        title: titleForSegment(hit.durationType, hit.effortContext, offset),
        durationType: hit.durationType,
        durationValue: hit.durationValue,
        repeatCount: hit.repeatCount > 1 ? hit.repeatCount : undefined,
        paceOffsetSecPerMile: offset,
        recoveryDurationType: recovery?.recoveryDurationType ?? null,
        recoveryDurationValue: recovery?.recoveryDurationValue ?? null,
        effortContext: hit.effortContext,
      },
    };
  });

  const bookends = scanBookendSegments(text).filter(
    (bookend) =>
      !workPieces.some(
        (hit) => bookend.index >= hit.index && bookend.index < hit.index + 18
      )
  );

  const segments = [...workPieces, ...bookends]
    .sort((a, b) => a.index - b.index)
    .map((piece) => piece.segment);

  const summary = text.replace(/\s+/g, " ").slice(0, 160);
  const hasTempo = segments.some((s) => s.title === "Tempo" || (s.durationType === "TIME" && s.title !== "Warmup" && s.title !== "Cooldown"));
  const hasIntervals = segments.some((s) => s.title === "Intervals");
  const hasMarathonRepeats = workPieces.some(
    (hit) =>
      (hit.segment.repeatCount ?? 0) > 1 &&
      /\bmarathon\b|\bmp\b/i.test(hit.segment.effortContext ?? "")
  );
  let suggestedTitle = "Parsed workout";
  if (hasMarathonRepeats) suggestedTitle = "Marathon pace repeats";
  else if (hasTempo && hasIntervals) suggestedTitle = "Tempo + intervals";
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

  return parsed.segments.map((seg, i) =>
    materializeOnePasteSegment(seg, i + 1, anchorSec, seg.effortContext)
  );
}

function materializeOnePasteSegment(
  seg: ParsedPasteSegment,
  stepOrder: number,
  anchorSec: number | null,
  effortContextForPace?: string
): WorkoutStep {
  let targets: WorkoutStep["targets"];
  const paceContext = effortContextForPace ?? "";
  const explicit = parseExplicitPaceSecPerMile(paceContext);
  if (explicit) {
    targets = [
      {
        type: "PACE",
        valueLow: secondsPerMileToSecondsPerKm(explicit.low),
        valueHigh: secondsPerMileToSecondsPerKm(explicit.high),
      },
    ];
  } else if (
    seg.paceOffsetSecPerMile != null &&
    Number.isFinite(seg.paceOffsetSecPerMile) &&
    anchorSec != null
  ) {
    const centerSec = Math.max(1, anchorSec + seg.paceOffsetSecPerMile);
    targets = [paceTargetFromSecondsPerMile(centerSec)];
  }

  return {
    stepOrder,
    title: seg.title,
    durationType: seg.durationType,
    durationValue: seg.durationValue,
    repeatCount: seg.repeatCount,
    targets,
    recoveryDurationType:
      seg.recoveryDurationType && seg.recoveryDurationValue != null
        ? seg.recoveryDurationType
        : null,
    recoveryDurationValue:
      seg.recoveryDurationType && seg.recoveryDurationValue != null
        ? seg.recoveryDurationValue
        : null,
  };
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
