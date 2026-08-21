/** Curated slugs stored on athlete_races.motivationIcon; keep in sync with normalizeMotivationIcon in goal-service. */
export const MOTIVATION_ICON_SLUGS = [
  "sparkles",
  "trophy",
  "heart",
  "flame",
  "sunrise",
  "mountain",
  "zap",
  "star",
] as const;

export type MotivationIconSlug = (typeof MOTIVATION_ICON_SLUGS)[number];
