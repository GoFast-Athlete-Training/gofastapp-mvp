/** Shared types for week aggregates (safe for client + server). */

export type WeekPerformanceSnapshot = {
  sessionsPlanned: number;
  sessionsCompleted: number;
  qualitySessionsPlanned: number;
  qualitySessionsCompleted: number;
  qualityAvgDeltaSecPerMile: number | null;
  plannedMetersTotal: number;
  actualMetersMatched: number;
  weeklyMileageCompletionPct: number | null;
  longRunCompleted: boolean;
  longRunCompletionRatio: number | null;
};
