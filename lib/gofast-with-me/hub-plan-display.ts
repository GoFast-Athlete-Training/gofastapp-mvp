import type { GoFastWithMeTrainingSummary } from '@/lib/gofast-with-me/training-for-types';

type PublishedPlanLike = {
  name: string;
  totalWeeks: number;
  currentWeekNumber?: number | null;
} | null | undefined;

export function hubPlanDisplay(
  publishedPlan: PublishedPlanLike,
  trainingSummary: GoFastWithMeTrainingSummary | null | undefined
): { planName: string | null; week: number; total: number; pct: number } | null {
  const planName = publishedPlan?.name ?? trainingSummary?.planName ?? null;
  const total = publishedPlan?.totalWeeks ?? trainingSummary?.totalWeeks ?? 0;
  if (!total || total <= 0) return null;

  let week =
    publishedPlan?.currentWeekNumber ??
    trainingSummary?.currentWeekNumber ??
    null;
  if (week == null || week < 1) {
    week = 1;
  }
  week = Math.max(1, Math.min(total, week));
  const pct = Math.min(100, Math.round((week / total) * 100));
  return { planName, week, total, pct };
}

export function initialHubPlanWeek(
  publishedPlan: PublishedPlanLike,
  trainingSummary: GoFastWithMeTrainingSummary | null | undefined
): number {
  if (publishedPlan?.currentWeekNumber != null && publishedPlan.currentWeekNumber >= 1) {
    return Math.min(publishedPlan.totalWeeks, publishedPlan.currentWeekNumber);
  }
  if (trainingSummary?.currentWeekNumber != null && trainingSummary.currentWeekNumber >= 1) {
    const total = trainingSummary.totalWeeks ?? publishedPlan?.totalWeeks ?? 1;
    return Math.min(total, trainingSummary.currentWeekNumber);
  }
  return 1;
}
