import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';
import { athleteCommunityPath } from '@/lib/gofast-with-me/athlete-community-routes';

export function formatPlanDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isPlanPublic(plan: ShareHubPlanStatus): boolean {
  return plan.isPublished && plan.publicVisibility === 'PUBLIC';
}

export function canPublishPlan(plan: ShareHubPlanStatus | null | undefined): boolean {
  return Boolean(plan?.hasActivePlan && plan?.hasSchedule);
}

export function buildPlanSummaryParts(plan: ShareHubPlanStatus | null | undefined): string[] {
  if (!plan) return [];

  const raceLine = [plan.raceName, plan.raceDistanceLabel].filter(Boolean).join(' · ');
  const durationLine =
    plan.totalWeeks != null
      ? `${plan.totalWeeks} week${plan.totalWeeks === 1 ? '' : 's'}`
      : null;

  return [
    durationLine,
    plan.startDate ? `starts ${formatPlanDate(plan.startDate)}` : null,
    raceLine || null,
    plan.goalRaceTime ? `goal ${plan.goalRaceTime}` : null,
  ].filter((part): part is string => Boolean(part));
}

export function hubPlanStripPath(landingSlug: string): string {
  return athleteCommunityPath(landingSlug, 'plan');
}

export function publicPlanPagePath(planSlug: string): string {
  return `/plans/${encodeURIComponent(planSlug)}`;
}
