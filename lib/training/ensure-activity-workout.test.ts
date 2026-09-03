import assert from 'node:assert/strict';
import test from 'node:test';

import { mapSeedToEnsureWorkout } from './ensure-activity-workout';

test('already-linked seed returns workoutId', () => {
  const mapped = mapSeedToEnsureWorkout({
    workoutId: 'w-1',
    alreadyLinked: true,
  });
  assert.deepEqual(mapped, { ok: true, workoutId: 'w-1', alreadyLinked: true });
});

test('fresh seed returns workoutId', () => {
  const mapped = mapSeedToEnsureWorkout({
    workoutId: 'w-2',
  });
  assert.deepEqual(mapped, { ok: true, workoutId: 'w-2', alreadyLinked: false });
});

test('seed failure does not invent a workoutId', () => {
  const mapped = mapSeedToEnsureWorkout({ workoutId: null });
  assert.equal(mapped.ok, false);
  if (!mapped.ok) {
    assert.equal(mapped.reason, 'could_not_seed');
  }
});
