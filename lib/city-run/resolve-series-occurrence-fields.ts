export type FieldSource = "occurrence" | "series";

export type SeriesOccurrenceFieldContext = {
  occurrenceMeetUpPoint?: string | null;
  seriesMeetUpPoint?: string | null;
  occurrenceStartTimeHour?: number | null;
  occurrenceStartTimeMinute?: number | null;
  occurrenceStartTimePeriod?: string | null;
  seriesStartTimeHour?: number | null;
  seriesStartTimeMinute?: number | null;
  seriesStartTimePeriod?: string | null;
  occurrenceDescription?: string | null;
  seriesDescription?: string | null;
};

export type ResolvedSeriesOccurrenceFields = {
  meetUpPoint: string | null;
  meetUpPointSource: FieldSource | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  scheduleSource: FieldSource | null;
  description: string | null;
  descriptionSource: FieldSource | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function pickString(
  occurrence: string | null | undefined,
  series: string | null | undefined
): { value: string | null; source: FieldSource | null } {
  const occ = trimOrNull(occurrence);
  if (occ) return { value: occ, source: "occurrence" };
  const ser = trimOrNull(series);
  if (ser) return { value: ser, source: "series" };
  return { value: null, source: null };
}

function pickTime(ctx: SeriesOccurrenceFieldContext): {
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  scheduleSource: FieldSource | null;
} {
  const occHasTime =
    ctx.occurrenceStartTimeHour != null && ctx.occurrenceStartTimeMinute != null;
  if (occHasTime) {
    return {
      startTimeHour: ctx.occurrenceStartTimeHour ?? null,
      startTimeMinute: ctx.occurrenceStartTimeMinute ?? null,
      startTimePeriod: trimOrNull(ctx.occurrenceStartTimePeriod) ?? "AM",
      scheduleSource: "occurrence",
    };
  }
  const serHasTime =
    ctx.seriesStartTimeHour != null && ctx.seriesStartTimeMinute != null;
  if (serHasTime) {
    return {
      startTimeHour: ctx.seriesStartTimeHour ?? null,
      startTimeMinute: ctx.seriesStartTimeMinute ?? null,
      startTimePeriod: trimOrNull(ctx.seriesStartTimePeriod) ?? "AM",
      scheduleSource: "series",
    };
  }
  return {
    startTimeHour: null,
    startTimeMinute: null,
    startTimePeriod: null,
    scheduleSource: null,
  };
}

/** Occurrence-specific values win; series defaults fill only empty occurrence fields. */
export function resolveSeriesOccurrenceFields(
  ctx: SeriesOccurrenceFieldContext
): ResolvedSeriesOccurrenceFields {
  const meetUp = pickString(ctx.occurrenceMeetUpPoint, ctx.seriesMeetUpPoint);
  const description = pickString(ctx.occurrenceDescription, ctx.seriesDescription);
  const time = pickTime(ctx);

  return {
    meetUpPoint: meetUp.value,
    meetUpPointSource: meetUp.source,
    description: description.value,
    descriptionSource: description.source,
    ...time,
  };
}
