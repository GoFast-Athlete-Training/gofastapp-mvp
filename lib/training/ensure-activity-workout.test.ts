import assert from 'node:assert/strict';
import test from 'node:test';

import { mapPromoteToEnsureWorkout } from './ensure-activity-workout';

test('already-linked promote returns workoutId', () => {
  const mapped = mapPromoteToEnsureWorkout({
    promoted: true,
    workoutId: 'w-1',
    alreadyLinked: true,
  });
  assert.deepEqual(mapped, { ok: true, workoutId: 'w-1', alreadyLinked: true });
});

test('fresh promote returns workoutId', () => {
  const mapped = mapPromoteToEnsureWorkout({
    promoted: true,
    workoutId: 'w-2',
  });
  assert.deepEqual(mapped, { ok: true, workoutId: 'w-2', alreadyLinked: false });
});

test('blocked-by-planned-workout is a clear failure', () => {
  const mapped = mapPromoteToEnsureWorkout({
    promoted: false,
    blockedByPlannedWorkout: true,
  });
  assert.equal(mapped.ok, false);
  if (!mapped.ok) {
    assert.equal(mapped.reason, 'blocked_by_planned_workout');
    assert.match(mapped.message, /planned workout/i);
  }
});

test('generic promote failure does not invent a workoutId', () => {
  const mapped = mapPromoteToEnsureWorkout({ promoted: false });
  assert.equal(mapped.ok, false);
  if (!mapped.ok) {
    assert.equal(mapped.reason, 'could_not_promote');
  }
});
