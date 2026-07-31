import { describe, expect, it } from 'vitest';
import {
  buildPlanSummaryParts,
  canPublishPlan,
  hubPlanStripPath,
  isPlanPublic,
  publicPlanPagePath,
} from './plan-sharing-utils';
import type { ShareHubPlanStatus } from '../profile/share-creator-card-logic';

const basePlan: ShareHubPlanStatus = {
  hasActivePlan: true,
  planId: 'plan-1',
  planName: "Adam's plan",
  hasSchedule: true,
  isPublished: true,
  publicSlug: 'adams-plan',
  publicVisibility: 'PUBLIC',
  publicDescription: 'Building toward Boston.',
  publicPublishedAt: '2026-01-01T00:00:00.000Z',
  startDate: '2026-01-05T00:00:00.000Z',
  totalWeeks: 20,
  raceName: 'Boston Marathon',
  raceDistanceLabel: '26.2 mi',
  goalRaceTime: '2:59:00',
};

describe('isPlanPublic', () => {
  it('requires published public visibility', () => {
    expect(isPlanPublic(basePlan)).toBe(true);
    expect(
      isPlanPublic({ ...basePlan, publicVisibility: 'DRAFT', isPublished: false })
    ).toBe(false);
  });
});

describe('canPublishPlan', () => {
  it('requires active plan with schedule', () => {
    expect(canPublishPlan(basePlan)).toBe(true);
    expect(canPublishPlan({ ...basePlan, hasSchedule: false })).toBe(false);
    expect(canPublishPlan(null)).toBe(false);
  });
});

describe('buildPlanSummaryParts', () => {
  it('joins race, duration, and goal facts', () => {
    const parts = buildPlanSummaryParts(basePlan);
    expect(parts.some((p) => p.includes('20 week'))).toBe(true);
    expect(parts.some((p) => p.includes('Boston Marathon'))).toBe(true);
    expect(parts.some((p) => p.includes('goal 2:59:00'))).toBe(true);
  });
});

describe('preview paths', () => {
  it('builds hub and plan page URLs', () => {
    expect(hubPlanStripPath('adam')).toBe('/container/adam#plan-strip');
    expect(publicPlanPagePath('adams-plan')).toBe('/plans/adams-plan');
  });
});
