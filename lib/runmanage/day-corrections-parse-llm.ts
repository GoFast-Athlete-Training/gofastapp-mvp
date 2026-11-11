import { parseDayCorrectionsCsv, type DayCorrectionRow } from "@/lib/runmanage/day-corrections";
import { completeJsonObjectWithSystem } from "@/lib/services/race-parse/openai-json";
import type { DayValidateRunRow } from "@/lib/runmanage/day-validate-llm-packet";

const CSV_HEADER = "runId,field,action,value";

function looksLikeDayCorrectionsCsv(text: string): boolean {
  const first = text.trim().split(/\r?\n/)[0]?.toLowerCase() ?? "";
  return first.includes("runid") && first.includes("field");
}

function rowToCsvLine(row: DayCorrectionRow): string {
  return [row.runId, row.field, row.action, row.value].map(escapeCsvCell).join(",");
}

function escapeCsvCell(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function normalizeRow(raw: Record<string, unknown>, line: number): DayCorrectionRow | null {
  const runId = String(raw.runId ?? raw.run_id ?? "").trim();
  const field = String(raw.field ?? "").trim().toLowerCase();
  const action = String(raw.action ?? "replace").trim().toLowerCase();
  const value = String(raw.value ?? "").trim();
  if (!runId || !field) return null;
  if (!["title", "date", "starttime", "meetuppoint"].includes(field)) return null;
  const normalizedField =
    field === "starttime" ? "startTime" : field === "meetuppoint" ? "meetUpPoint" : field;
  return {
    line,
    runId,
    field: normalizedField as DayCorrectionRow["field"],
    action,
    value,
  };
}

export async function parseDayCorrectionsPaste(
  pasteText: string,
  runs: DayValidateRunRow[]
): Promise<{ csvText: string; parseErrors: string[] }> {
  const trimmed = pasteText.trim();
  if (!trimmed) {
    return { csvText: "", parseErrors: ["Paste text is empty"] };
  }

  if (looksLikeDayCorrectionsCsv(trimmed)) {
    const { parseErrors } = parseDayCorrectionsCsv(trimmed);
    return { csvText: trimmed, parseErrors };
  }

  const runSnapshot = runs
    .map(
      (r) =>
        `runId=${r.id} title="${r.title}" date=${r.dateYmd} startTime=${r.startTimeLabel} meetUp=${r.meetUpPoint ?? ""}`
    )
    .join("\n");

  const system = `You convert LLM run-schedule validation replies into correction CSV rows.
Output JSON: { "rows": [ { "runId", "field", "action", "value" } ] }
field must be one of: title, date, startTime, meetUpPoint
action: replace (default)
date value: YYYY-MM-DD
startTime value: like "6:30 PM"
Only include rows where the validation recommends a concrete change.`;

  const user = `Runs on this city/day:\n${runSnapshot}\n\n---\nLLM validation reply to convert:\n${trimmed}`;

  let parsed: Record<string, unknown>;
  try {
    parsed = await completeJsonObjectWithSystem(system, user, 0);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    return { csvText: "", parseErrors: [msg] };
  }

  const rawRows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const rows: DayCorrectionRow[] = [];
  const parseErrors: string[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const item = rawRows[i];
    if (!item || typeof item !== "object") continue;
    const row = normalizeRow(item as Record<string, unknown>, i + 2);
    if (!row) {
      parseErrors.push(`Row ${i + 2}: could not normalize`);
      continue;
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    return { csvText: "", parseErrors: parseErrors.length ? parseErrors : ["No corrections found in paste"] };
  }

  const csvText = [CSV_HEADER, ...rows.map(rowToCsvLine)].join("\n");
  const { parseErrors: csvErr } = parseDayCorrectionsCsv(csvText);
  return { csvText, parseErrors: [...parseErrors, ...csvErr] };
}
