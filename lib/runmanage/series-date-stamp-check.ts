export type SeriesStampInput = {
  dayOfWeek: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  meetUpPoint: string | null;
  description?: string | null;
};

export type SeriesDateStampRowKind =
  | "open"
  | "reuse_last_run"
  | "build_first_run"
  | "stamp_incomplete";

export type SeriesDateStampCheck = {
  kind: SeriesDateStampRowKind;
  missingStampFields: string[];
  missingDescription: boolean;
};

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function missingSeriesStampFields(series: SeriesStampInput): string[] {
  const missing: string[] = [];
  if (!filled(series.dayOfWeek)) missing.push("day");
  if (series.startTimeHour == null) missing.push("start time");
  if (!filled(series.meetUpPoint)) missing.push("meet-up");
  return missing;
}

/**
 * Week-scoped matcher: what should the operator do for this series on targetDateYmd?
 */
export function checkSeriesDateStamp(opts: {
  series: SeriesStampInput;
  weekRunId: string | null;
  latestPriorRunId: string | null;
}): SeriesDateStampCheck {
  const missingStampFields = missingSeriesStampFields(opts.series);
  const missingDescription = !filled(opts.series.description);

  if (opts.weekRunId) {
    return { kind: "open", missingStampFields: [], missingDescription };
  }

  if (missingStampFields.length > 0) {
    return { kind: "stamp_incomplete", missingStampFields, missingDescription };
  }

  if (opts.latestPriorRunId) {
    return { kind: "reuse_last_run", missingStampFields: [], missingDescription };
  }

  return { kind: "build_first_run", missingStampFields: [], missingDescription };
}

export function seriesDateStampLabel(kind: SeriesDateStampRowKind): string {
  switch (kind) {
    case "open":
      return "Scheduled";
    case "reuse_last_run":
      return "Reuse last run";
    case "build_first_run":
      return "Build this run instance";
    case "stamp_incomplete":
      return "Series incomplete";
    default:
      return kind;
  }
}
