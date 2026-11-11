import type { DayCorrectionField } from "@/lib/runmanage/day-corrections";

export const RUN_VALIDATE_SNAPSHOT_HEADER = "field,value";

export const RUN_VALIDATE_SNAPSHOT_FIELDS = [
  "title",
  "date",
  "startTime",
  "meetUpPoint",
] as const satisfies readonly DayCorrectionField[];

export type RunValidateSnapshotField = (typeof RUN_VALIDATE_SNAPSHOT_FIELDS)[number];

export type RunValidateSnapshot = Record<RunValidateSnapshotField, string>;

function esc(v: string): string {
  const t = v ?? "";
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function buildRunValidateSnapshotCsv(snapshot: RunValidateSnapshot): string {
  const lines = [RUN_VALIDATE_SNAPSHOT_HEADER];
  for (const field of RUN_VALIDATE_SNAPSHOT_FIELDS) {
    lines.push([field, esc(snapshot[field] ?? "")].join(","));
  }
  return lines.join("\n");
}

/** Pull a field,value block out of a longer LLM reply when present. */
export function extractRunSnapshotCsv(text: string): string {
  const trimmed = text.trim();
  const lines = trimmed.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.toLowerCase().startsWith("field,"));
  if (idx >= 0) return lines.slice(idx).join("\n");
  return trimmed;
}

export function isRunSnapshotCsv(text: string): boolean {
  const block = extractRunSnapshotCsv(text);
  const first = block.split(/\r?\n/)[0]?.toLowerCase() ?? "";
  return first.startsWith("field,") || first.includes("field,value");
}

export function parseRunSnapshotCsv(text: string): {
  snapshot: Partial<RunValidateSnapshot>;
  parseErrors: string[];
} {
  const parseErrors: string[] = [];
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    return { snapshot: {}, parseErrors: ["CSV is empty"] };
  }
  const header = lines[0].toLowerCase();
  if (!header.includes("field")) {
    parseErrors.push(`Expected header ${RUN_VALIDATE_SNAPSHOT_HEADER}`);
    return { snapshot: {}, parseErrors };
  }
  const snapshot: Partial<RunValidateSnapshot> = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 2) continue;
    const field = cols[0]?.trim().toLowerCase();
    const value = cols.slice(1).join(",").replace(/^"|"$/g, "").replace(/""/g, '"');
    if (RUN_VALIDATE_SNAPSHOT_FIELDS.includes(field as RunValidateSnapshotField)) {
      snapshot[field as RunValidateSnapshotField] = value.trim();
    }
  }
  return { snapshot, parseErrors };
}

/** Turn returned field,value into day-correction rows when values changed from baseline. */
export function runSnapshotToDayCorrectionsCsv(
  runId: string,
  baseline: RunValidateSnapshot,
  returnedCsv: string
): { csvText: string; parseErrors: string[] } {
  const { snapshot, parseErrors } = parseRunSnapshotCsv(returnedCsv);
  if (parseErrors.length && Object.keys(snapshot).length === 0) {
    return { csvText: "", parseErrors };
  }
  const rows: string[] = ["runId,field,action,value"];
  for (const field of RUN_VALIDATE_SNAPSHOT_FIELDS) {
    const after = snapshot[field]?.trim() ?? "";
    const before = baseline[field]?.trim() ?? "";
    if (!after || after === before) continue;
    rows.push([runId, field, "replace", esc(after)].join(","));
  }
  return { csvText: rows.length > 1 ? rows.join("\n") : "", parseErrors };
}

export function formatWizardStartTime(
  hour: string,
  minute: string,
  period: string
): string {
  const h = hour.trim();
  const m = minute.trim();
  if (!h && !m) return "";
  const min = m.padStart(2, "0");
  return `${h}:${min}${period?.trim() ? ` ${period.trim()}` : ""}`;
}
