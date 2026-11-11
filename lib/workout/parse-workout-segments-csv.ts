import { parsePaceToSecondsPerMile, secondsPerMileToSecondsPerKm } from "@/lib/workout-generator/pace-calculator";
import type { WorkoutStep } from "@/lib/training/prescription";

export const WORKOUT_SEGMENT_CSV_TEMPLATE = `title,durationType,durationValue,pace,repeatCount
Warmup,DISTANCE,2,8:30,
Work,TIME,3,7:25,8
Easy,TIME,3,8:25,
Cooldown,DISTANCE,1.5,9:00,
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
  const repeatIdx = header.indexOf("repeatcount");
  if (titleIdx < 0 || typeIdx < 0 || valueIdx < 0) {
    return {
      steps: [],
      error: "Header must include title, durationType, durationValue (optional: pace, repeatCount).",
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
    const paceRaw = paceIdx >= 0 ? cols[paceIdx]?.trim() : "";
    let targets: WorkoutStep["targets"];
    if (paceRaw) {
      try {
        const secMi = parsePaceToSecondsPerMile(paceRaw);
        const secKm = secondsPerMileToSecondsPerKm(secMi);
        targets = [{ type: "PACE", valueLow: secKm, valueHigh: secKm }];
      } catch {
        return { steps: [], error: `Row ${i + 1}: pace must be M:SS (e.g. 7:25).` };
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
    });
  }
  return { steps };
}
