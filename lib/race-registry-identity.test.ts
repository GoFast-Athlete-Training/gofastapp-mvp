import { describe, expect, it } from 'vitest';
import { raceDateUtcWindow } from './race-registry-identity';

describe('raceDateUtcWindow', () => {
  it('returns a one-day UTC window', () => {
    const d = new Date('2026-09-20T15:30:00.000Z');
    const { gte, lt } = raceDateUtcWindow(d);
    expect(gte.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(lt.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });
});
