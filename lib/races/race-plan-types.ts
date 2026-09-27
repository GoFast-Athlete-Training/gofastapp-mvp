/** Athlete-authored race plan document (not a workout prescription). */
export type RacePlanBlock = {
  mileStart: number;
  mileEnd: number;
  paceLow: string;
  paceHigh: string;
  /** When target pace is open-ended, e.g. "or best sustainable pace". */
  paceNote?: string;
  effort: string;
  instruction: string;
  cue: string;
};

export type RacePlanDocument = {
  goal: string;
  primaryRule: string;
  blocks: RacePlanBlock[];
};

export const EMPTY_RACE_PLAN: RacePlanDocument = {
  goal: "",
  primaryRule: "",
  blocks: [],
};

export function racePlanHasBlocks(doc: RacePlanDocument): boolean {
  return doc.blocks.some((b) => b.mileEnd > b.mileStart && b.mileEnd - b.mileStart > 0);
}

export function blockDistanceMiles(block: RacePlanBlock): number {
  const d = block.mileEnd - block.mileStart;
  return d > 0 ? d : 0;
}

export function formatBlockMileRange(block: RacePlanBlock): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${fmt(block.mileStart)}–${fmt(block.mileEnd)}`;
}

export function formatBlockPaceBand(block: RacePlanBlock): string {
  const band = `${block.paceLow}–${block.paceHigh}/mi`;
  if (block.paceNote?.trim()) return `${band} ${block.paceNote.trim()}`;
  return band;
}
