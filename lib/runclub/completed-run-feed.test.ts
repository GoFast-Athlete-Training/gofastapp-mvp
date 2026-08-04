import { describe, expect, it } from 'vitest';
import {
  COMPLETED_RUN_FEED_DAYS,
  completedRunFeedWindowStart,
  formatCompletedRunFeedItem,
} from './completed-run-feed';

describe('completed-run-feed', () => {
  it('uses 14-day window', () => {
    expect(COMPLETED_RUN_FEED_DAYS).toBe(14);
    const now = new Date('2026-08-04T12:00:00.000Z');
    const start = completedRunFeedWindowStart(now);
    expect(start.toISOString()).toBe('2026-07-21T12:00:00.000Z');
  });

  it('formats feed item', () => {
    const item = formatCompletedRunFeedItem({
      id: 'run-1',
      slug: 'tuesday-tempo',
      title: 'Tuesday Tempo',
      date: new Date('2026-08-01T10:00:00.000Z'),
      meetUpPoint: 'Corner Park',
      postRunNote: 'Great turnout',
      postRunPhotoUrl: 'https://example.com/photo.jpg',
      postRunPublishedAt: new Date('2026-08-01T14:00:00.000Z'),
    });
    expect(item.runId).toBe('run-1');
    expect(item.postRunNote).toBe('Great turnout');
    expect(item.postRunPublishedAt).toBe('2026-08-01T14:00:00.000Z');
  });
});
