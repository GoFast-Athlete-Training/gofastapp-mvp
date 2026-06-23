import { describe, expect, it } from 'vitest';
import { computeSetupCompleteness } from './run-club-leader-setup';

describe('computeSetupCompleteness', () => {
  it('flags missing meta fields', () => {
    const result = computeSetupCompleteness({
      club: { description: '  ', allRunsDescription: null, logoUrl: null },
      seriesCount: 1,
      upcomingRunCount: 2,
      runsNeedReview: 0,
    });

    expect(result.metaComplete).toBe(false);
    expect(result.metaMissing).toContain('Club description');
    expect(result.metaMissing).toContain('All runs description');
    expect(result.metaMissing).toContain('Logo');
    expect(result.hasSeries).toBe(true);
    expect(result.readyForMembers).toBe(false);
  });

  it('marks ready when meta, series, and runs exist', () => {
    const result = computeSetupCompleteness({
      club: {
        description: 'A great club',
        allRunsDescription: 'We run Tuesdays',
        logoUrl: 'https://example.com/logo.png',
        websiteUrl: 'https://example.com',
      },
      seriesCount: 2,
      upcomingRunCount: 3,
      runsNeedReview: 1,
    });

    expect(result.metaComplete).toBe(true);
    expect(result.metaMissing).toHaveLength(0);
    expect(result.readyForMembers).toBe(true);
    expect(result.runsNeedReview).toBe(1);
  });
});
