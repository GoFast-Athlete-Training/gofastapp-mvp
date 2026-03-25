/**
 * Shared phase parsing + per-week labels (client + server).
 */

export type PhaseRange = { name: string; startWeek: number; endWeek: number };

export function parsePhasesJson(phases: unknown): PhaseRange[] {
  if (!Array.isArray(phases)) return [];
  const out: PhaseRange[] = [];
  for (const p of phases) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    const startWeek = Number(o.startWeek);
    const endWeek = Number(o.endWeek);
    if (!name || !Number.isFinite(startWeek) || !Number.isFinite(endWeek)) continue;
    out.push({ name, startWeek, endWeek });
  }
  out.sort((a, b) => a.startWeek - b.startWeek);
  return out;
}

function titleCasePhase(name: string): string {
  const s = name.trim();
  if (!s) return "Training";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Label for a week from phase ranges; falls back when JSON missing or gaps. */
export function phaseNameForWeek(
  phases: PhaseRange[],
  weekNumber: number,
  fallbackFromWeek?: string
): string {
  for (const p of phases) {
    if (weekNumber >= p.startWeek && weekNumber <= p.endWeek) {
      return titleCasePhase(p.name);
    }
  }
  if (fallbackFromWeek?.trim()) return titleCasePhase(fallbackFromWeek);
  return "Training";
}
