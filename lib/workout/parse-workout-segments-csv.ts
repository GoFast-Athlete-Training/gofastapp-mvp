import {
  parsePaceToSecondsPerMile,
  secondsPerMileToStoredPaceSecKm,
} from "@/lib/workout-generator/pace-calculator";
import type { WorkoutStep } from "@/lib/training/prescription";

export const WORKOUT_SEGMENT_CSV_TEMPLATE = `title,durationType,durationValue,paceMin,paceMax,repeatCount,recoveryDurationType,recoveryDurationValue
Warmup,DISTANCE,2,8:30,8:49,,,
Work,DISTANCE,5,6:50,7:00,3,DISTANCE,0.5
Cooldown,DISTANCE,1.5,9:00,9:10,,,
`;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function paceEdgeSecKm(raw: string): number {
  return secondsPerMileToStoredPaceSecKm(parsePaceToSecondsPerMile(raw));
}

/** CSV import keeps the name already on the form. It does not invent "CSV workout". */
export function titleAfterSegmentCsvImport(currentTitle: string): string {
  return currentTitle.trim();
}

export function parseWorkoutSegmentsCsv(text: string): { steps: WorkoutStep[]; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length < 2) {
    return { steps: [], error: "CSV needs a header row and at least one segment." };
  }

  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const titleIdx = header.indexOf("title");
  const typeIdx = header.indexOf("durationtype");
  const valueIdx = header.indexOf("durationvalue");
  const paceIdx = header.indexOf("pace");
  const paceMinIdx = header.findIndex((h) => h === "pacemin" || h === "pace_min");
  const paceMaxIdx = header.findIndex((h) => h === "pacemax" || h === "pace_max");
  const repeatIdx = header.indexOf("repeatcount");
  const recoveryTypeIdx = header.findIndex(
    (h) => h === "recoverydurationtype" || h === "recoverytype"
  );
  const recoveryValueIdx = header.findIndex(
    (h) => h === "recoverydurationvalue" || h === "recoveryvalue"
  );
  if (titleIdx < 0 || typeIdx < 0 || valueIdx < 0) {
    return {
      steps: [],
      error:
        "Header must include title, durationType, durationValue (optional: paceMin, paceMax, repeatCount, recoveryDurationType, recoveryDurationValue).",
    };
  }

  const steps: WorkoutStep[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!);
    const title = cols[titleIdx]?.trim() || `Segment ${i}`;
    const durationTypeRaw = (cols[typeIdx] ?? "").toUpperCase();
    const durationType = durationTypeRaw === "TIME" ? "TIME" : "DISTANCE";
    const durationValue = parseFloat(cols[valueIdx] ?? "");
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      return { steps: [], error: `Row ${i + 1}: durationValue must be a positive number.` };
    }
    const repeatRaw = repeatIdx >= 0 ? cols[repeatIdx]?.trim() : "";
    const repeatCount = repeatRaw ? parseInt(repeatRaw, 10) : undefined;
    const recoveryTypeRaw =
      recoveryTypeIdx >= 0 ? (cols[recoveryTypeIdx] ?? "").trim().toUpperCase() : "";
    const recoveryValueRaw =
      recoveryValueIdx >= 0 ? (cols[recoveryValueIdx] ?? "").trim() : "";
    let recoveryDurationType: "DISTANCE" | "TIME" | null = null;
    let recoveryDurationValue: number | null = null;
    if (recoveryTypeRaw || recoveryValueRaw) {
      if (recoveryTypeRaw !== "DISTANCE" && recoveryTypeRaw !== "TIME") {
        return {
          steps: [],
          error: `Row ${i + 1}: recoveryDurationType must be DISTANCE or TIME.`,
        };
      }
      const recoveryValue = parseFloat(recoveryValueRaw);
      if (!Number.isFinite(recoveryValue) || recoveryValue <= 0) {
        return {
          steps: [],
          error: `Row ${i + 1}: recoveryDurationValue must be a positive number.`,
        };
      }
      recoveryDurationType = recoveryTypeRaw;
      recoveryDurationValue = recoveryValue;
    }
    const paceMinRaw = paceMinIdx >= 0 ? cols[paceMinIdx]?.trim() ?? "" : "";
    const paceMaxRaw = paceMaxIdx >= 0 ? cols[paceMaxIdx]?.trim() ?? "" : "";
    const paceRaw = paceIdx >= 0 ? cols[paceIdx]?.trim() ?? "" : "";
    const lowSource = paceMinRaw || (!paceMaxRaw ? paceRaw : "");
    const highSource = paceMaxRaw || (!paceMinRaw ? paceRaw : "");
    let targets: WorkoutStep["targets"];
    if (lowSource || highSource) {
      try {
        const lowSec = paceEdgeSecKm(lowSource || highSource);
        const highSec = paceEdgeSecKm(highSource || lowSource);
        targets = [
          {
            type: "PACE",
            valueLow: Math.min(lowSec, highSec),
            valueHigh: Math.max(lowSec, highSec),
          },
        ];
      } catch {
        return {
          steps: [],
          error: `Row ${i + 1}: paceMin and paceMax must be M:SS (e.g. 6:50).`,
        };
      }
    }
    steps.push({
      stepOrder: steps.length + 1,
      title,
      durationType,
      durationValue,
      repeatCount:
        repeatCount != null && Number.isFinite(repeatCount) && repeatCount > 1
          ? repeatCount
          : undefined,
      targets,
      ...(recoveryDurationType
        ? { recoveryDurationType, recoveryDurationValue }
        : {}),
    });
  }
  return { steps };
}
