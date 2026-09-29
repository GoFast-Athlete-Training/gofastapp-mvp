import {
  formatSeriesRowTitle,
  formatSeriesTimeNarrative,
  normalizeNarrativeTimeCasing,
  normalizeTimeStringNarrative,
} from "@/lib/acqRunSeriesDisplay";
import { seriesStartTimePartsFromFormFields } from "@/lib/acqRunSeries";
import { isTrackRun } from "@/lib/runTypes";
import type { AcqSeriesRow, PendingAiScheduleRow } from "@/components/runclub/edit/types";

export type SeriesDescriptionAiContext = {
  acqRunClubId: string;
  runClubName: string;
  runUrl?: string | null;
  rawPasteFromRunWeb?: string | null;
  allRunsDescription?: string | null;
};

/** Whether a saved series row has the minimum fields before building instances. */
export function seriesIsWhole(row: {
  meetUpPoint?: string | null;
  description?: string | null;
}): boolean {
  if (!row.meetUpPoint?.trim()) return false;
  if (!row.description?.trim()) return false;
  return true;
}

/** Minimum fields to create / save a series from ingest. */
export function seriesCanBuild(row: {
  meetUpPoint?: string | null;
  description?: string | null;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  time?: string | null;
}): boolean {
  if (!row.meetUpPoint?.trim()) return false;
  if (!row.description?.trim()) return false;
  if (row.startTimeHour != null || row.time?.trim()) return true;
  return false;
}

export function buildSeriesDescriptionContextNotes(
  row: AcqSeriesRow | PendingAiScheduleRow,
  opts?: { allRunsDescription?: string | null; clubName?: string }
): string {
  const isSavedRow = "dayOfWeek" in row;
  const day = isSavedRow ? row.dayOfWeek : row.day;
  const seriesName = isSavedRow
    ? row.name?.trim() ||
      formatSeriesRowTitle({
        name: row.name,
        dayOfWeek: row.dayOfWeek,
        clubName: opts?.clubName,
      })
    : row.seriesName;
  const time = isSavedRow
    ? formatSeriesTimeNarrative(row.startTimeHour, row.startTimeMinute, row.startTimePeriod)
    : (() => {
        const tp = seriesStartTimePartsFromFormFields(row);
        if (tp) return formatSeriesTimeNarrative(tp.hour, tp.minute, tp.period);
        return normalizeTimeStringNarrative(row.time);
      })();
  const location = isSavedRow ? row.meetUpPoint : row.location;
  const routeNeighborhood = row.routeNeighborhood;
  const miles = isSavedRow
    ? row.totalMiles != null
      ? String(row.totalMiles)
      : ""
    : row.miles;
  const runType = row.runType;
  const postRunActivity = row.postRunActivity;
  const sourceDescriptor =
    !isSavedRow && "sourceDescription" in row && row.sourceDescription?.trim()
      ? row.sourceDescription.trim()
      : null;

  return [
    `Series title: ${seriesName}`,
    `Day: ${day}`,
    time ? `Time: ${time}` : null,
    location ? `Meet-up: ${location}` : null,
    routeNeighborhood ? `Route context: ${routeNeighborhood}` : null,
    miles ? `Miles: ${miles}` : null,
    runType ? `Run type: ${runType}` : null,
    sourceDescriptor ? `Source descriptor: ${sourceDescriptor}` : null,
    isTrackRun(runType) && !sourceDescriptor
      ? "Track default: structured speed workout using typical interval patterns prescribed each week; weekly specifics live on run events."
      : null,
    !isSavedRow && sourceDescriptor && /seasonal|variable|alternate meet-up|newsletter/i.test(sourceDescriptor)
      ? "Variable series: weekly meet-up and start time may change; confirm details in club newsletter or run events."
      : null,
    postRunActivity ? `Post-run activity: ${postRunActivity}` : null,
    opts?.allRunsDescription?.trim()
      ? `[ALL-RUNS OVERVIEW]\n${opts.allRunsDescription.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSeriesDescriptionAiPayload(
  row: AcqSeriesRow | PendingAiScheduleRow,
  ctx: SeriesDescriptionAiContext
): Record<string, unknown> {
  const dayOfWeek = "dayOfWeek" in row ? row.dayOfWeek : row.day;
  const seriesName =
    "dayOfWeek" in row
      ? row.name?.trim() ||
        formatSeriesRowTitle({
          name: row.name,
          dayOfWeek: row.dayOfWeek,
          clubName: ctx.runClubName,
        })
      : row.seriesName;
  const description =
    "dayOfWeek" in row ? row.description?.trim() ?? "" : row.description.trim();

  return {
    acqRunClubId: ctx.acqRunClubId,
    runClubName: ctx.runClubName || undefined,
    webUrl: ctx.runUrl?.trim() || undefined,
    pastedText: ctx.rawPasteFromRunWeb?.trim() || undefined,
    contextNotes: buildSeriesDescriptionContextNotes(row, {
      allRunsDescription: ctx.allRunsDescription,
      clubName: ctx.runClubName,
    }),
    dayOfWeek,
    output: "series",
    existingSeries: {
      name: seriesName || undefined,
      description: description || undefined,
    },
  };
}

export function parseSeriesDescriptionFromResponse(data: unknown): string | null {
  const d = data as {
    success?: boolean;
    seriesData?: { description?: string };
    description?: string;
    error?: string;
  };
  if (!d?.success) return null;
  const generated = d.seriesData?.description ?? d.description;
  if (typeof generated !== "string" || !generated.trim()) return null;
  return normalizeNarrativeTimeCasing(generated.trim());
}
