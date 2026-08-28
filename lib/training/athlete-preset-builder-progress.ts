export type AthletePresetBuilderProgress = {
  cupsConfirmed?: boolean;
  longRunConfirmed?: boolean;
  easyConfirmed?: boolean;
  tempoPicked?: boolean;
  tempoConfirmed?: boolean;
  intervalPicked?: boolean;
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
    tempoPicked: bool("tempoPicked"),
    tempoConfirmed: bool("tempoConfirmed"),
    intervalPicked: bool("intervalPicked"),
    intervalConfirmed: bool("intervalConfirmed"),
    adjusterConfirmed: bool("adjusterConfirmed"),
  };
}

export type QualityStepKind = "tempo" | "interval";

/** UI sub-phase for tempo/interval builder steps. */
export function qualityStepSubPhase(
  progress: AthletePresetBuilderProgress,
  kind: QualityStepKind
): "pick" | "order" {
  const picked = kind === "tempo" ? progress.tempoPicked : progress.intervalPicked;
  const confirmed = kind === "tempo" ? progress.tempoConfirmed : progress.intervalConfirmed;
  if (confirmed) return "order";
  if (picked) return "order";
  return "pick";
}
