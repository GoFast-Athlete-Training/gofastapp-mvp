export type AthletePresetBuilderProgress = {
  cupsConfirmed?: boolean;
  longRunConfirmed?: boolean;
  easyConfirmed?: boolean;
  tempoConfirmed?: boolean;
  intervalConfirmed?: boolean;
  adjusterConfirmed?: boolean;
};

export function builderProgressFromOverview(raw: unknown): AthletePresetBuilderProgress {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const bool = (k: keyof AthletePresetBuilderProgress) => o[k] === true;
  return {
    cupsConfirmed: bool("cupsConfirmed"),
    longRunConfirmed: bool("longRunConfirmed"),
    easyConfirmed: bool("easyConfirmed"),
    tempoConfirmed: bool("tempoConfirmed"),
    intervalConfirmed: bool("intervalConfirmed"),
    adjusterConfirmed: bool("adjusterConfirmed"),
  };
}
