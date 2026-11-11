import {
  buildDayValidateLlmPacket,
  dayRunRowFromManageRun,
  type DayValidateRunRow,
} from "@/lib/runmanage/day-validate-llm-packet";

export type RunValidatePacketInput = {
  id: string;
  title: string;
  date: string | Date;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint?: string | null;
  description?: string | null;
  stravaMapUrl?: string | null;
  routeNotes?: string | null;
  stravaEventUrl?: string | null;
  webUrl?: string | null;
  runClub?: {
    name?: string | null;
    websiteUrl?: string | null;
    stravaUrl?: string | null;
  } | null;
};

/** One-run LLM packet for staff run dashboard — same correction CSV as day validate. */
export function buildRunValidateLlmPacket(opts: {
  cityLabel: string;
  run: RunValidatePacketInput;
}): { packet: string; row: DayValidateRunRow } {
  const row = dayRunRowFromManageRun(opts.run);
  const dayYmd = row.dateYmd;
  const base = buildDayValidateLlmPacket({
    cityLabel: opts.cityLabel,
    dayYmd,
    runs: [row],
  });

  const extra: string[] = [
    "",
    "---",
    "Additional context for this run (read-only for fact-check; corrections still use runId,field,action,value):",
    "",
    `Description (public): ${(opts.run.description ?? "").trim() || "(empty)"}`,
    `Strava route link: ${(opts.run.stravaMapUrl ?? "").trim() || "(none)"}`,
    `Route notes: ${(opts.run.routeNotes ?? "").trim() || "(none)"}`,
  ];

  return { packet: `${base}${extra.join("\n")}`, row };
}
