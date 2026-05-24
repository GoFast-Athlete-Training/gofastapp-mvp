/** Shared types for week aggregates (safe for client + server). */

export type WeekPerformanceSnapshot = {
  sessionsPlanned: number;
  sessionsCompleted: number;
  sessionsSkipped: number;
  sessionsMissed: number;
  structuredSessionsPlanned: number;
  structuredSessionsCompleted: number;
  structuredPaceAvgDeltaSecPerMile: number | null;
  plannedMetersTotal: number;
  actualMetersMatched: number;
  weeklyMileageCompletionPct: number | null;
  longRunCompleted: boolean;
  longRunCompletionRatio: number | null;
};
