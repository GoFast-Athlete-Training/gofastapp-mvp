import {
  parsePaceToSecondsPerMile,
  secondsPerMileToSecondsPerKm,
} from "@/lib/workout-generator/pace-calculator";

export type RacePaceWorkBlock = {
  name: string;
  miles: number;
  /** PACE target sec/km (encoding v2). */
  paceValueLow?: number;
  paceValueHigh?: number;
};

export type RacePaceApiSegment = {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets?: Array<{
    type: string;
    valueLow?: number;
    valueHigh?: number;
    value?: number;
  }>;
};

const TABULAR_MILE_PACE_ROW = /^\s*(\d+\.?\d*)\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s*$/;
const NAMED_BEFORE_PIPE =
  /^\s*(.+?)\s*\|\s*(\d+\.?\d*)\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s*$/;
const NAMED_AFTER_PIPE =
  /^\s*(\d+\.?\d*)\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s*\|\s*(.+)\s*$/;

function paceBandFromMiStrings(lowStr: string, highStr: string): { valueLow: number; valueHigh: number } | null {
  try {
    const s1 = parsePaceToSecondsPerMile(lowStr.trim());
    const s2 = parsePaceToSecondsPerMile(highStr.trim());
    const k1 = secondsPerMileToSecondsPerKm(s1);
    const k2 = secondsPerMileToSecondsPerKm(s2);
    return { valueLow: Math.min(k1, k2), valueHigh: Math.max(k1, k2) };
  } catch {
    return null;
  }
}

function segmentFromRow(
  title: string,
  miles: number,
  paceLow: string,
  paceHigh: string,
  stepOrder: number
): RacePaceApiSegment | null {
  if (!Number.isFinite(miles) || miles <= 0) return null;
  const band = paceBandFromMiStrings(paceLow, paceHigh);
  if (!band) return null;
  return {
    stepOrder,
    title: title.trim() || `Block ${stepOrder}`,
    durationType: "DISTANCE",
    durationValue: miles,
    targets: [{ type: "PACE", valueLow: band.valueLow, valueHigh: band.valueHigh }],
  };
}

/**
 * Parse one line per block. Supports optional athlete label via pipe:
 * `Open space for 5 | 5 7:00 7:20` or `5 7:00 7:20 | start out strong`
 */
export function tryParseTabularRacePacePaste(text: string): RacePaceApiSegment[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const out: RacePaceApiSegment[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let seg: RacePaceApiSegment | null = null;

    const beforePipe = line.match(NAMED_BEFORE_PIPE);
    if (beforePipe) {
      seg = segmentFromRow(
        beforePipe[1],
        parseFloat(beforePipe[2]),
        beforePipe[3],
        beforePipe[4],
        i + 1
      );
    }
    if (!seg) {
      const afterPipe = line.match(NAMED_AFTER_PIPE);
      if (afterPipe) {
        seg = segmentFromRow(
          afterPipe[4],
          parseFloat(afterPipe[1]),
          afterPipe[2],
          afterPipe[3],
          i + 1
        );
      }
    }
    if (!seg) {
      const plain = line.match(TABULAR_MILE_PACE_ROW);
      if (plain) {
        seg = segmentFromRow(`Block ${i + 1}`, parseFloat(plain[1]), plain[2], plain[3], i + 1);
      }
    }
    if (!seg) return null;
    out.push(seg);
  }
  return out;
}

function paceBandSecKmFromTarget(t: {
  type?: string;
  valueLow?: number;
  valueHigh?: number;
  value?: number;
}): { low?: number; high?: number } {
  if (String(t.type ?? "").toUpperCase() !== "PACE") return {};
  const vl = typeof t.valueLow === "number" && Number.isFinite(t.valueLow) ? t.valueLow : undefined;
  const vh = typeof t.valueHigh === "number" && Number.isFinite(t.valueHigh) ? t.valueHigh : undefined;
  const v = typeof t.value === "number" && Number.isFinite(t.value) ? t.value : undefined;
  if (vl != null && vh != null) return { low: Math.min(vl, vh), high: Math.max(vl, vh) };
  if (v != null) return { low: v, high: v };
  if (vl != null) return { low: vl, high: vl };
  if (vh != null) return { low: vh, high: vh };
  return {};
}

/** All segments become named work blocks — no warmup/cooldown routing. */
export function apiSegmentsToFlatWorkBlocks(segments: RacePaceApiSegment[]): RacePaceWorkBlock[] {
  return segments.map((seg, i) => {
    let paceValueLow: number | undefined;
    let paceValueHigh: number | undefined;
    for (const raw of seg.targets ?? []) {
      const band = paceBandSecKmFromTarget(raw);
      if (band.low != null) {
        paceValueLow = band.low;
        paceValueHigh = band.high ?? band.low;
        break;
      }
    }
    const miles =
      typeof seg.durationValue === "number" && seg.durationValue > 0 ? seg.durationValue : 0;
    return {
      name: seg.title?.trim() || `Block ${i + 1}`,
      miles,
      paceValueLow,
      paceValueHigh,
    };
  });
}

export function racePaceWorkBlocksToRaceDaySegments(blocks: RacePaceWorkBlock[]) {
  return blocks
    .filter((b) => b.miles > 0)
    .map((b, i) => {
      const low = b.paceValueLow ?? b.paceValueHigh;
      const high = b.paceValueHigh ?? b.paceValueLow;
      const targets =
        low != null
          ? [
              {
                type: "PACE" as const,
                valueLow: Math.min(low, high ?? low),
                valueHigh: Math.max(high ?? low, low),
              },
            ]
          : [];
      return {
        stepOrder: i + 1,
        title: b.name.trim() || `Block ${i + 1}`,
        durationType: "DISTANCE" as const,
        durationValue: b.miles,
        targets,
      };
    });
}

export function raceDaySegmentsToWorkBlocks(
  segments: Array<{
    title: string;
    durationType: string;
    durationValue: number;
    targets?: Array<{ type: string; valueLow?: number; valueHigh?: number }>;
  }>
): RacePaceWorkBlock[] {
  return segments.map((seg, i) => {
    const paceTarget = seg.targets?.find((t) => String(t.type).toUpperCase() === "PACE");
    const lowKm = paceTarget?.valueLow;
    const highKm = paceTarget?.valueHigh ?? lowKm;
    return {
      name: seg.title?.trim() || `Block ${i + 1}`,
      miles: seg.durationType === "DISTANCE" ? seg.durationValue : 0,
      paceValueLow: lowKm,
      paceValueHigh: highKm,
    };
  });
}
