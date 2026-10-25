import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { parseCsvRow } from "@/lib/training/parse-plan-week-csv-shared";
import { RacePlanParseError, type RacePlanBlock } from "@/lib/races/race-plan-types";

function nonEmptyLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function normalizeHeaderCell(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, "_");
}

function isMileCsvHeaderLine(line: string): boolean {
  const cells = parseCsvRow(line).map(normalizeHeaderCell);
  return cells.includes("mile_start") && cells.includes("mile_end");
}

/** First data row looks like start,end,... without a header row. */
function isMileCsvDataRow(line: string): boolean {
  const cells = parseCsvRow(line);
  if (cells.length < 2) return false;
  const start = parseFloat(cells[0]!);
  const end = parseFloat(cells[1]!);
  return Number.isFinite(start) && Number.isFinite(end);
}

export function looksLikeRacePlanMileCsv(sourceText: string): boolean {
  const lines = nonEmptyLines(sourceText);
  if (lines.length === 0) return false;
  if (isMileCsvHeaderLine(lines[0]!)) return true;
  return isMileCsvDataRow(lines[0]!);
}

function colIndex(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const i = headers.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

function cellAt(cells: string[], index: number): string {
  if (index < 0 || index >= cells.length) return "";
  return cells[index]!.trim();
}

function paceLooksValid(pace: string): boolean {
  if (!pace.trim()) return false;
  try {
    parsePaceToSecondsPerMile(pace.trim());
    return true;
  } catch {
    return false;
  }
}

function blockFromCsvRow(
  cells: string[],
  headers: string[] | null,
  blockIndex: number
): RacePlanBlock | null {
  let mileStartIdx = 0;
  let mileEndIdx = 1;
  let targetPaceIdx = 2;
  let paceMinIdx = 3;
  let paceMaxIdx = 4;
  let focusIdx = 5;

  if (headers) {
    mileStartIdx = colIndex(headers, "mile_start");
    mileEndIdx = colIndex(headers, "mile_end");
    targetPaceIdx = colIndex(headers, "target_pace");
    paceMinIdx = colIndex(headers, "pace_min");
    paceMaxIdx = colIndex(headers, "pace_max");
    focusIdx = colIndex(headers, "focus", "cue", "instruction");
    if (mileStartIdx < 0 || mileEndIdx < 0) return null;
  }

  const mileStart = parseFloat(cellAt(cells, mileStartIdx));
  const mileEnd = parseFloat(cellAt(cells, mileEndIdx));
  if (!Number.isFinite(mileStart) || !Number.isFinite(mileEnd) || mileEnd <= mileStart) {
    return null;
  }

  let paceLow = cellAt(cells, paceMinIdx);
  let paceHigh = cellAt(cells, paceMaxIdx);
  const targetPace = cellAt(cells, targetPaceIdx);

  if (!paceLooksValid(paceLow) && !paceLooksValid(paceHigh)) {
    if (paceLooksValid(targetPace)) {
      paceLow = targetPace;
      paceHigh = targetPace;
    } else {
      return null;
    }
  } else {
    if (!paceLooksValid(paceLow) && paceLooksValid(paceHigh)) paceLow = paceHigh;
    if (!paceLooksValid(paceHigh) && paceLooksValid(paceLow)) paceHigh = paceLow;
  }

  const focus = cellAt(cells, focusIdx);
  const cue = focus || `Block ${blockIndex + 1}`;

  return {
    mileStart,
    mileEnd,
    paceLow,
    paceHigh,
    effort: "",
    instruction: focus,
    cue,
  };
}

export function parseBlocksFromMileCsv(sourceText: string): RacePlanBlock[] {
  const lines = nonEmptyLines(sourceText);
  if (lines.length === 0) return [];

  let headers: string[] | null = null;
  let startLine = 0;
  if (isMileCsvHeaderLine(lines[0]!)) {
    headers = parseCsvRow(lines[0]!).map(normalizeHeaderCell);
    startLine = 1;
  }

  const blocks: RacePlanBlock[] = [];
  for (let i = startLine; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]!);
    const block = blockFromCsvRow(cells, headers, blocks.length);
    if (block) blocks.push(block);
  }
  return blocks;
}

export function parseRacePlanFromMileCsv(sourceText: string): {
  goal: string;
  primaryRule: string;
  blocks: RacePlanBlock[];
} {
  const blocks = parseBlocksFromMileCsv(sourceText);
  if (blocks.length === 0) {
    throw new RacePlanParseError(
      "Could not parse mile CSV. Use columns mile_start, mile_end, pace_min, pace_max (or target_pace), and optional focus."
    );
  }
  return { goal: "", primaryRule: "", blocks };
}
