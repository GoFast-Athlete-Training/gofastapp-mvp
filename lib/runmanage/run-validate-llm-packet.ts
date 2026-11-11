import { dayRunRowFromManageRun, type DayValidateRunRow } from "@/lib/runmanage/day-validate-llm-packet";
import {
  buildRunValidateSnapshotCsv,
  formatWizardStartTime,
  type RunValidateSnapshot,
} from "@/lib/runmanage/run-validate-snapshot-csv";

export type RunClubMetaForValidate = {
  name?: string | null;
  runUrl?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  stravaUrl?: string | null;
  allRunsDescription?: string | null;
};

export type RunValidatePacketInput = {
  id: string;
  title: string;
  date: string | Date;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  /** Wizard string fields when building from live form */
  startTimeHourStr?: string;
  startTimeMinuteStr?: string;
  startTimePeriodStr?: string;
  meetUpPoint?: string | null;
  stravaEventUrl?: string | null;
  webUrl?: string | null;
  seriesSourceText?: string | null;
  clubMeta?: RunClubMetaForValidate | null;
};

function dateYmdFromRun(date: string | Date): string {
  if (typeof date === "string") return date.slice(0, 10);
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }
  return "";
}

function startTimeLabel(input: RunValidatePacketInput): string {
  if (input.startTimeHourStr !== undefined) {
    return (
      formatWizardStartTime(
        input.startTimeHourStr,
        input.startTimeMinuteStr ?? "",
        input.startTimePeriodStr ?? ""
      ) || "(not set)"
    );
  }
  const row = dayRunRowFromManageRun({
    id: input.id,
    title: input.title,
    date: input.date,
    startTimeHour: input.startTimeHour,
    startTimeMinute: input.startTimeMinute,
    startTimePeriod: input.startTimePeriod,
    meetUpPoint: input.meetUpPoint,
    runClub: input.clubMeta ? { name: input.clubMeta.name } : null,
    stravaEventUrl: input.stravaEventUrl,
    webUrl: input.webUrl,
  });
  return row.startTimeLabel === "—" ? "(not set)" : row.startTimeLabel;
}

function buildSnapshot(input: RunValidatePacketInput): RunValidateSnapshot {
  const time = startTimeLabel(input);
  return {
    title: input.title.trim(),
    date: dateYmdFromRun(input.date),
    startTime: time === "(not set)" ? "" : time,
    meetUpPoint: (input.meetUpPoint ?? "").trim(),
  };
}

function sourceLines(club: RunClubMetaForValidate | null | undefined, run: RunValidatePacketInput): string[] {
  const lines: string[] = ["Sources"];
  if (club?.runUrl?.trim()) lines.push(`Club runs page: ${club.runUrl.trim()}`);
  else lines.push("Club runs page: (not on club)");
  if (club?.websiteUrl?.trim()) lines.push(`Club website: ${club.websiteUrl.trim()}`);
  else lines.push("Club website: (not on club)");
  if (club?.instagramUrl?.trim()) lines.push(`Instagram: ${club.instagramUrl.trim()}`);
  else lines.push("Instagram: (not on club)");
  if (club?.stravaUrl?.trim()) lines.push(`Strava club: ${club.stravaUrl.trim()}`);
  else lines.push("Strava club: (not on club)");
  if (run.stravaEventUrl?.trim()) lines.push(`Strava event (this run): ${run.stravaEventUrl.trim()}`);
  if (run.webUrl?.trim()) lines.push(`Web listing (this run): ${run.webUrl.trim()}`);
  return lines;
}

/** One-run LLM packet — plain language + field,value snapshot (race validate pattern). */
export function buildRunValidateLlmPacket(opts: {
  cityLabel: string;
  run: RunValidatePacketInput;
}): { packet: string; row: DayValidateRunRow; snapshot: RunValidateSnapshot } {
  const snapshot = buildSnapshot(opts.run);
  const csv = buildRunValidateSnapshotCsv(snapshot);

  const row = dayRunRowFromManageRun({
    id: opts.run.id,
    title: opts.run.title,
    date: opts.run.date,
    startTimeHour: opts.run.startTimeHour,
    startTimeMinute: opts.run.startTimeMinute,
    startTimePeriod: opts.run.startTimePeriod,
    meetUpPoint: opts.run.meetUpPoint,
    stravaEventUrl: opts.run.stravaEventUrl,
    webUrl: opts.run.webUrl,
    runClub: {
      name: opts.run.clubMeta?.name,
      websiteUrl: opts.run.clubMeta?.websiteUrl,
      stravaUrl: opts.run.clubMeta?.stravaUrl,
    },
  });

  const instructions = [
    "Check the run facts below against the sources.",
    `Return the same CSV with header ${csv.split("\n")[0]}.`,
    "Change a value cell only when a source says it is wrong. Leave every other row exactly as written.",
    "Do not return JSON, prose-only answers, or a runId,field,action,value file.",
  ].join(" ");

  const meta: string[] = [
    `Run: ${opts.run.title.trim() || "(no title)"}`,
    `City: ${opts.cityLabel}`,
    `Date: ${snapshot.date || "(not set)"}`,
    `Start time: ${startTimeLabel(opts.run)}`,
    `Meet-up: ${snapshot.meetUpPoint || "(not set)"}`,
    clubNameLine(opts.run.clubMeta?.name),
    "",
    ...sourceLines(opts.run.clubMeta, opts.run),
  ];

  const blurb: string[] = [];
  const clubBlurb = opts.run.clubMeta?.allRunsDescription?.trim();
  const seriesText = opts.run.seriesSourceText?.trim();
  if (clubBlurb || seriesText) {
    meta.push("", "Series / club source text");
    if (clubBlurb) blurb.push(clubBlurb.slice(0, 1200));
    if (seriesText) blurb.push(seriesText.slice(0, 1200));
    meta.push(...blurb);
  }

  meta.push("", instructions, "", "RUN CHECK — edit value cells only", "", csv);

  return { packet: meta.join("\n"), row, snapshot };
}

function clubNameLine(name?: string | null): string {
  return `Club: ${name?.trim() || "(not set)"}`;
}
