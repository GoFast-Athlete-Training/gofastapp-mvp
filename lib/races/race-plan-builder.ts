import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import {
  EMPTY_RACE_PLAN,
  type RacePlanBlock,
  type RacePlanDocument,
} from "@/lib/races/race-plan-types";

export class RacePlanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RacePlanParseError";
  }
}

const BLOCK_HEADER =
  /^\s*BLOCK\s+\d+\s*[—–-]\s*Miles\s+([\d.]+)\s+to\s+([\d.]+)\s*$/im;

function parsePaceBandLine(raw: string): Pick<RacePlanBlock, "paceLow" | "paceHigh" | "paceNote"> | null {
  const line = raw.trim();
  const m = line.match(
    /Target\s+Pace:\s*(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*\/?\s*mi(?:\s*(.+))?/i
  );
  if (!m) return null;
  const paceNote = m[3]?.trim() || undefined;
  return { paceLow: m[1]!, paceHigh: m[2]!, paceNote };
}

function fieldAfter(label: string, chunk: string): string {
  const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\s*(?:Cue:|BLOCK\\s+\\d|Primary rule:|Race sequence:|$))`, "i");
  const m = chunk.match(re);
  return m?.[1]?.trim().replace(/\s+/g, " ") ?? "";
}

function parseBlocksFromDocument(text: string): RacePlanBlock[] {
  const blocks: RacePlanBlock[] = [];
  const parts = text.split(/\n(?=\s*BLOCK\s+\d+\s*[—–-])/i);
  for (const part of parts) {
    const header = part.match(BLOCK_HEADER);
    if (!header) continue;
    const mileStart = parseFloat(header[1]!);
    const mileEnd = parseFloat(header[2]!);
    if (!Number.isFinite(mileStart) || !Number.isFinite(mileEnd) || mileEnd <= mileStart) continue;

    const pace = parsePaceBandLine(part);
    if (!pace) continue;

    const effort = fieldAfter("Effort", part);
    const instruction = fieldAfter("Instruction", part);
    const cueMatch = part.match(/Cue:\s*(.+?)(?:\n|$)/i);
    const cue = cueMatch?.[1]?.trim() ?? "";

    blocks.push({
      mileStart,
      mileEnd,
      paceLow: pace.paceLow,
      paceHigh: pace.paceHigh,
      paceNote: pace.paceNote,
      effort,
      instruction,
      cue: cue || `Block ${blocks.length + 1}`,
    });
  }
  return blocks;
}

function parseGoal(text: string): string {
  const m = text.match(/^\s*Goal:\s*(.+?)(?:\n\n|\n\s*BLOCK\s|\n\s*Primary rule:)/ims);
  if (m?.[1]?.trim()) return m[1].trim().replace(/\s+/g, " ");
  const beforeBlock = text.split(/\n\s*BLOCK\s+\d/i)[0]?.trim();
  if (beforeBlock && !/^\s*Goal:/i.test(beforeBlock)) {
    const lines = beforeBlock.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) return lines.slice(1).join(" ");
  }
  return "";
}

function parsePrimaryRule(text: string): string {
  const m = text.match(/Primary rule:\s*([\s\S]+?)(?:\n\s*Race sequence:|$)/i);
  return m?.[1]?.trim().replace(/\s+/g, " ") ?? "";
}

/** Parse a coach-style race plan document into planJson. */
export function parseRacePlanDocument(sourceText: string): RacePlanDocument {
  const text = sourceText.trim();
  if (!text) throw new RacePlanParseError("Paste your race plan first.");

  const blocks = parseBlocksFromDocument(text);
  if (blocks.length === 0) {
    throw new RacePlanParseError(
      "Could not find race blocks. Use BLOCK n — Miles a to b with Target Pace, Effort, Instruction, and Cue."
    );
  }

  return {
    goal: parseGoal(text),
    primaryRule: parsePrimaryRule(text),
    blocks,
  };
}

export function parseRacePlanFromPaste(sourceText: string): RacePlanDocument {
  return parseRacePlanDocument(sourceText);
}

export function validateRacePlanDocument(doc: RacePlanDocument): void {
  if (!doc.blocks.length) {
    throw new RacePlanParseError("Add at least one block with a mile range.");
  }
  for (const b of doc.blocks) {
    if (b.mileEnd <= b.mileStart) {
      throw new RacePlanParseError(`Block "${b.cue}" needs a positive mile range.`);
    }
    for (const p of [b.paceLow, b.paceHigh]) {
      try {
        parsePaceToSecondsPerMile(p);
      } catch {
        throw new RacePlanParseError(`Block "${b.cue}" has invalid pace: ${p}`);
      }
    }
  }
}

export function normalizeRacePlanDocument(raw: unknown): RacePlanDocument {
  if (!raw || typeof raw !== "object") return { ...EMPTY_RACE_PLAN };
  const o = raw as Record<string, unknown>;
  const blocksRaw = Array.isArray(o.blocks) ? o.blocks : [];
  const blocks: RacePlanBlock[] = blocksRaw.map((row, i) => {
    const b = row as Record<string, unknown>;
    return {
      mileStart: Number(b.mileStart) || 0,
      mileEnd: Number(b.mileEnd) || 0,
      paceLow: String(b.paceLow ?? "").trim(),
      paceHigh: String(b.paceHigh ?? "").trim(),
      paceNote: typeof b.paceNote === "string" ? b.paceNote.trim() : undefined,
      effort: String(b.effort ?? "").trim(),
      instruction: String(b.instruction ?? "").trim(),
      cue: String(b.cue ?? "").trim() || `Block ${i + 1}`,
    };
  });
  return {
    goal: String(o.goal ?? "").trim(),
    primaryRule: String(o.primaryRule ?? "").trim(),
    blocks,
  };
}
