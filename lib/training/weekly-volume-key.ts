/**
 * Shared weekly volume key — us, athlete copy, and OpenAI use the same rows.
 * Peak weekly mileage from goal + aggressiveness. Not current mpw. Not Peak/Base.
 * Not the 4-Saturday long-run pool (that is peakLongRunPoolMiles).
 *
 * Coach analogs: Higdon Novice ~40 · Higdon Intermediate ~50 · Hansons Advanced / Pfitz 55.
 * Product elite weekly caps at 50–60 — we do not ship Pfitz 70+.
 */

export type WeeklyVolumeBand = "FINISH" | "RACE" | "ELITE";

export type WeeklyVolumeKeyRow = {
  band: WeeklyVolumeBand;
  minWeeklyMiles: number;
  maxWeeklyMiles: number;
  athleteLabel: string;
  signals: string;
  coachAnalog: string;
};

const MARATHON_KEY: Record<WeeklyVolumeBand, WeeklyVolumeKeyRow> = {
  FINISH: {
    band: "FINISH",
    minWeeklyMiles: 34,
    maxWeeklyMiles: 40,
    athleteLabel: "Finish week — 34–40 mi",
    signals: "just finish, complete, first marathon chill, conservative",
    coachAnalog: "Higdon Novice",
  },
  RACE: {
    band: "RACE",
    minWeeklyMiles: 40,
    maxWeeklyMiles: 48,
    athleteLabel: "Race week — 40–48 mi",
    signals: "solid PR, competitive but not sub-3 / BQ crush",
    coachAnalog: "Higdon Intermediate",
  },
  ELITE: {
    band: "ELITE",
    minWeeklyMiles: 50,
    maxWeeklyMiles: 60,
    athleteLabel: "Elite week — 50–60 mi",
    signals: "sub-3, crush this, BQ, really go for it",
    coachAnalog: "Hansons Advanced / Pfitz 55 floor",
  },
};

/** Shorter-race scale of the same three names — still goal-driven. */
const SHORT_RACE_KEY: Record<WeeklyVolumeBand, WeeklyVolumeKeyRow> = {
  FINISH: {
    ...MARATHON_KEY.FINISH,
    minWeeklyMiles: 20,
    maxWeeklyMiles: 28,
    athleteLabel: "Finish week — 20–28 mi",
  },
  RACE: {
    ...MARATHON_KEY.RACE,
    minWeeklyMiles: 28,
    maxWeeklyMiles: 38,
    athleteLabel: "Race week — 28–38 mi",
  },
  ELITE: {
    ...MARATHON_KEY.ELITE,
    minWeeklyMiles: 40,
    maxWeeklyMiles: 50,
    athleteLabel: "Elite week — 40–50 mi",
  },
};

export function weeklyVolumeKeyForDistance(
  raceDistanceLabel: string | null | undefined
): Record<WeeklyVolumeBand, WeeklyVolumeKeyRow> {
  const d = (raceDistanceLabel ?? "").toLowerCase();
  if (/\b(5k|10k|8k|half)\b/.test(d) && !/\bmarathon\b/.test(d)) {
    return SHORT_RACE_KEY;
  }
  return MARATHON_KEY;
}

export function weeklyVolumeKeyPromptTable(raceDistanceLabel?: string | null): string {
  const key = weeklyVolumeKeyForDistance(raceDistanceLabel);
  return (
    `weeklyVolumeBand | min–max weekly | when to pick | coach analog\n` +
    `FINISH | ${key.FINISH.minWeeklyMiles}–${key.FINISH.maxWeeklyMiles} | ${key.FINISH.signals} | ${key.FINISH.coachAnalog}\n` +
    `RACE | ${key.RACE.minWeeklyMiles}–${key.RACE.maxWeeklyMiles} | ${key.RACE.signals} | ${key.RACE.coachAnalog}\n` +
    `ELITE | ${key.ELITE.minWeeklyMiles}–${key.ELITE.maxWeeklyMiles} | ${key.ELITE.signals} | ${key.ELITE.coachAnalog}`
  );
}

export function parseWeeklyVolumeBand(raw: unknown): WeeklyVolumeBand | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toUpperCase();
  if (u === "FINISH" || u === "RACE" || u === "ELITE") return u;
  return null;
}

export function weeklyVolumeBandFromAggressiveness(
  aggressiveness: "CONSERVATIVE" | "MODERATE" | "AMBITIOUS"
): WeeklyVolumeBand {
  if (aggressiveness === "CONSERVATIVE") return "FINISH";
  if (aggressiveness === "AMBITIOUS") return "ELITE";
  return "RACE";
}

/** Athlete-facing band meaning for foundation min–max card (no coach jargon). */
export function foundationWeeklyBandMeaning(band: WeeklyVolumeBand): string {
  if (band === "FINISH") {
    return "Just finish / fun week — you're in the right range for this goal";
  }
  if (band === "RACE") {
    return "Solid week — good shape for a strong race";
  }
  return "Ready to go for it — you're in the right range";
}

export function inferWeeklyVolumeBandFromGoal(input: {
  trainingHistory: string;
  goalTime: string | null;
  racingForFun?: boolean;
}): WeeklyVolumeBand | null {
  if (input.racingForFun) return "FINISH";
  const blob = `${input.trainingHistory} ${input.goalTime ?? ""}`.toLowerCase();
  if (
    /\b(sub-?\s*3|sub3|boston|bq\b|qualif|crush|really go for|elite)\b/.test(blob)
  ) {
    return "ELITE";
  }
  if (
    /\b(just finish|just want to finish|complete|survive|first marathon|racing for fun|just racing)\b/.test(
      blob
    )
  ) {
    return "FINISH";
  }
  return null;
}

export function resolveWeeklyVolumeKey(input: {
  raceDistanceLabel?: string | null;
  weeklyVolumeBand?: unknown;
  progressionAggressiveness: "CONSERVATIVE" | "MODERATE" | "AMBITIOUS";
  trainingHistory?: string;
  goalTime?: string | null;
  racingForFun?: boolean;
}): WeeklyVolumeKeyRow {
  const key = weeklyVolumeKeyForDistance(input.raceDistanceLabel);
  const fromModel = parseWeeklyVolumeBand(input.weeklyVolumeBand);
  const fromGoal = inferWeeklyVolumeBandFromGoal({
    trainingHistory: input.trainingHistory ?? "",
    goalTime: input.goalTime ?? null,
    racingForFun: input.racingForFun,
  });
  const band =
    fromModel ?? fromGoal ?? weeklyVolumeBandFromAggressiveness(input.progressionAggressiveness);
  return key[band];
}

export function clampWeeklyRangeToKey(
  row: WeeklyVolumeKeyRow,
  minRaw: unknown,
  maxRaw: unknown
): { minWeeklyMiles: number; maxWeeklyMiles: number } {
  const minN = Number(minRaw);
  const maxN = Number(maxRaw);
  let min = Number.isFinite(minN) ? Math.round(minN) : row.minWeeklyMiles;
  let max = Number.isFinite(maxN) ? Math.round(maxN) : row.maxWeeklyMiles;
  min = Math.max(row.minWeeklyMiles, Math.min(row.maxWeeklyMiles, min));
  max = Math.max(row.minWeeklyMiles, Math.min(row.maxWeeklyMiles, max));
  if (max < min) max = min;
  return { minWeeklyMiles: min, maxWeeklyMiles: max };
}
