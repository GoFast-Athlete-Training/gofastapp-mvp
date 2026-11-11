export type DayValidateRunRow = {
  id: string;
  title: string;
  dateYmd: string;
  startTimeLabel: string;
  meetUpPoint: string | null;
  clubName: string | null;
  stravaEventUrl: string | null;
  webUrl: string | null;
  runClubWebsiteUrl: string | null;
  runClubStravaUrl: string | null;
};

function formatStartTime(
  hour: number | null,
  minute: number | null,
  period: string | null
): string {
  if (hour == null || minute == null) return "—";
  const min = String(minute).padStart(2, "0");
  return `${hour}:${min}${period?.trim() ? ` ${period.trim()}` : ""}`;
}

/** Plain-text packet for LLM fact-check — one metro day. */
export function buildDayValidateLlmPacket(opts: {
  cityLabel: string;
  dayYmd: string;
  runs: DayValidateRunRow[];
}): string {
  const lines: string[] = [
    `City: ${opts.cityLabel}`,
    `Date: ${opts.dayYmd}`,
    "",
    "Instruction: Compare each run below against its source URLs. Return corrections as CSV with header:",
    "runId,field,action,value",
    "field: title | date | startTime | meetUpPoint",
    "action: replace",
    "date value: YYYY-MM-DD",
    'startTime value: "H:MM AM/PM" (e.g. 6:30 PM)',
    "Only rows that need a change.",
    "",
    "---",
    "",
  ];

  if (opts.runs.length === 0) {
    lines.push("(No runs on file for this city and date.)");
    return lines.join("\n");
  }

  for (const run of opts.runs) {
    lines.push(`Run id: ${run.id}`);
    lines.push(`Title: ${run.title}`);
    lines.push(`Date: ${run.dateYmd}`);
    lines.push(`Start time: ${run.startTimeLabel}`);
    lines.push(`Meet-up: ${run.meetUpPoint?.trim() || "(not set)"}`);
    if (run.clubName) lines.push(`Club: ${run.clubName}`);
    const sources: string[] = [];
    if (run.stravaEventUrl?.trim()) sources.push(`Strava event: ${run.stravaEventUrl.trim()}`);
    if (run.webUrl?.trim()) sources.push(`Web listing: ${run.webUrl.trim()}`);
    if (run.runClubWebsiteUrl?.trim()) sources.push(`Club site: ${run.runClubWebsiteUrl.trim()}`);
    if (run.runClubStravaUrl?.trim()) sources.push(`Club Strava: ${run.runClubStravaUrl.trim()}`);
    lines.push(sources.length > 0 ? `Sources:\n${sources.map((s) => `  - ${s}`).join("\n")}` : "Sources: (none on file)");
    lines.push("");
  }

  return lines.join("\n");
}

export function dayRunRowFromManageRun(run: {
  id: string;
  title: string;
  date: string | Date;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint?: string | null;
  stravaEventUrl?: string | null;
  webUrl?: string | null;
  runClub?: {
    name?: string | null;
    websiteUrl?: string | null;
    stravaUrl?: string | null;
  } | null;
}): DayValidateRunRow {
  const d = typeof run.date === "string" ? run.date.slice(0, 10) : "";
  return {
    id: run.id,
    title: run.title,
    dateYmd: d,
    startTimeLabel: formatStartTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod),
    meetUpPoint: run.meetUpPoint ?? null,
    clubName: run.runClub?.name ?? null,
    stravaEventUrl: run.stravaEventUrl ?? null,
    webUrl: run.webUrl ?? null,
    runClubWebsiteUrl: run.runClub?.websiteUrl ?? null,
    runClubStravaUrl: run.runClub?.stravaUrl ?? null,
  };
}
