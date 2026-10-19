import type { WorkoutType } from "@prisma/client";

export function planWeekCsvNonCommentLines(sourceText: string): string[] {
  return sourceText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("#"));
}

export function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

export function mapCsvType(raw: string): WorkoutType | "SKIP_RACE" | null {
  const t = raw.trim().toLowerCase();
  if (!t) return "Easy";
  if (t === "race") return "SKIP_RACE";
  if (t === "shakeout") return "Easy";
  if (t === "easy" || t === "recovery") return "Easy";
  if (t === "tempo" || t === "threshold") return "Tempo";
  if (t === "intervals" || t === "interval" || t === "speed") return "Intervals";
  if (t === "long" || t === "longrun" || t === "long run") return "LongRun";
  if (/^easy$/i.test(raw.trim())) return "Easy";
  const cap = raw.trim();
  if (cap === "Tempo" || cap === "Intervals" || cap === "LongRun" || cap === "Easy") {
    return cap as WorkoutType;
  }
  return "Easy";
}

export function normalizeDateKey(cell: string): string | null {
  const s = cell.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1]!.padStart(2, "0");
    const dd = m[2]!.padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }
  return null;
}

export function ourDowFromDateKey(dateKey: string): number {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}
