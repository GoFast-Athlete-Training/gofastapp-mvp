export type DayCorrectionField = "title" | "date" | "startTime" | "meetUpPoint";

export type DayCorrectionRow = {
  line: number;
  runId: string;
  field: DayCorrectionField;
  action: string;
  value: string;
};

const CSV_HEADER = "runId,field,action,value";

const FIELD_SET = new Set<DayCorrectionField>(["title", "date", "startTime", "meetUpPoint"]);

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

export function parseDayCorrectionsCsv(text: string): {
  rows: DayCorrectionRow[];
  parseErrors: string[];
} {
  const parseErrors: string[] = [];
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    return { rows: [], parseErrors: ["CSV is empty"] };
  }
  const header = lines[0].toLowerCase();
  if (!header.includes("runid") || !header.includes("field")) {
    parseErrors.push(`Expected header like: ${CSV_HEADER}`);
  }
  const rows: DayCorrectionRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) {
      parseErrors.push(`Line ${i + 1}: need runId,field,action,value`);
      continue;
    }
    const [runId, field, action, value] = cols;
    if (!runId?.trim()) {
      parseErrors.push(`Line ${i + 1}: missing runId`);
      continue;
    }
    const f = field?.trim().toLowerCase() as DayCorrectionField;
    if (!FIELD_SET.has(f)) {
      parseErrors.push(`Line ${i + 1}: field must be title, date, startTime, or meetUpPoint`);
      continue;
    }
    rows.push({
      line: i + 1,
      runId: runId.trim(),
      field: f,
      action: action?.trim().toLowerCase() || "replace",
      value: value?.trim() ?? "",
    });
  }
  return { rows, parseErrors };
}

/** Parse "6:30 PM" or "6:30AM" into hour, minute, period. */
export function parseStartTimeValue(value: string): {
  startTimeHour: number;
  startTimeMinute: number;
  startTimePeriod: string;
} | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/i.exec(value.trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  const period = (m[3] || "AM").toUpperCase();
  return { startTimeHour: hour, startTimeMinute: minute, startTimePeriod: period };
}
