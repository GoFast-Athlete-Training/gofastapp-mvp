import { describe, expect, it } from 'vitest';
import { WORKOUT_BACKED_CITY_RUN_VISIBILITY } from './workout-backed-run-visibility';

describe('WORKOUT_BACKED_CITY_RUN_VISIBILITY', () => {
  it('publishes workout-backed city runs immediately', () => {
    expect(WORKOUT_BACKED_CITY_RUN_VISIBILITY.published).toBe(true);
    expect(WORKOUT_BACKED_CITY_RUN_VISIBILITY.workflowStatus).toBe('APPROVED');
  });
});
