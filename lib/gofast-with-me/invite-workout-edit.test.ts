import { describe, expect, it } from 'vitest';
import {
  applyPaceEaseToSegments,
  metersToMiles,
  milesToMeters,
  scaleSegmentDistances,
} from '@/lib/gofast-with-me/invite-workout-edit';
import type { WorkoutPreviewSegment } from '@/lib/training/workout-segment-preview';

const baseSegments: WorkoutPreviewSegment[] = [
  {
    id: 's1',
    title: 'Easy',
    durationType: 'DISTANCE',
    durationValue: 6437,
    stepOrder: 1,
    targets: [{ type: 'PACE_OFFSET', value: 60, valueLow: 60, valueHigh: 60 }],
  },
];

describe('invite-workout-edit', () => {
  it('converts miles and meters', () => {
    expect(metersToMiles(1609.34)).toBe(1);
    expect(milesToMeters(4)).toBeGreaterThan(6400);
  });

  it('shifts pace offsets for easier/quicker', () => {
    const easier = applyPaceEaseToSegments(baseSegments, baseSegments, 'easier');
    expect(easier[0].targets?.[0]?.value).toBe(75);
    const quicker = applyPaceEaseToSegments(baseSegments, baseSegments, 'quicker');
    expect(quicker[0].targets?.[0]?.value).toBe(45);
  });

  it('scales distance segments when miles change', () => {
    const scaled = scaleSegmentDistances(baseSegments, 6437, 3218);
    expect(scaled[0].durationValue).toBe(3218);
  });
});
