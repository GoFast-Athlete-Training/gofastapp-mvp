import type { RunInstanceWizardValues } from "@/components/runmanage/runInstanceWizard/shared";

/** Single-row template for create-from-scratch CSV intake */
export const SCRATCH_RUN_CSV_HEADERS = [
  "title",
  "date",
  "start_time_hour",
  "start_time_minute",
  "start_time_period",
  "meet_up_point",
  "meet_up_city",
  "meet_up_state",
  "total_miles",
  "pace",
  "description",
  "route_description",
  "strava_map_url",
  "run_type",
] as const;

export function scratchRunCsvTemplate(): string {
  return `${SCRATCH_RUN_CSV_HEADERS.join(",")}\nSaturday Social,2026-04-12,6,30,AM,Jefferson Memorial,Washington,DC,5,All Paces Welcome,Weekly group run,,,neighborhood`;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
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

export type ScratchCsvParseResult =
  | { ok: true; patch: Partial<RunInstanceWizardValues> }
  | { ok: false; error: string };

export function parseScratchRunCsv(text: string): ScratchCsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { ok: false, error: "CSV needs a header row and one data row." };
  }

  const headerCells = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dataCells = splitCsvLine(lines[1]);
  const row: Record<string, string> = {};
  headerCells.forEach((h, i) => {
    row[h] = dataCells[i] ?? "";
  });

  const required = ["title", "date", "meet_up_point"];
  for (const key of required) {
    if (!row[key]?.trim()) {
      return { ok: false, error: `Missing required column: ${key}` };
    }
  }

  const patch: Partial<RunInstanceWizardValues> = {
    title: row.title.trim(),
    date: row.date.trim(),
    startTimeHour: row.start_time_hour?.trim() ?? "",
    startTimeMinute: row.start_time_minute?.trim() ?? "",
    startTimePeriod: (row.start_time_period?.trim() || "AM").toUpperCase(),
    meetUpPoint: row.meet_up_point.trim(),
    meetUpCity: row.meet_up_city?.trim() ?? "",
    meetUpState: row.meet_up_state?.trim() ?? "",
    totalMiles: row.total_miles?.trim() ?? "",
    pace: row.pace?.trim() ?? "",
    description: row.description?.trim() ?? "",
    routeDescription: row.route_description?.trim() ?? "",
    stravaMapUrl: row.strava_map_url?.trim() ?? "",
    runType: row.run_type?.trim() ?? "",
  };

  return { ok: true, patch };
}
