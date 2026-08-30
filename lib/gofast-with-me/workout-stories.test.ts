import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeWorkoutStoryInput,
  validateWorkoutStoryInput,
} from './workout-stories';

test('validateWorkoutStoryInput requires title, reflection, or photo', () => {
  const empty = normalizeWorkoutStoryInput({});
  assert.equal(validateWorkoutStoryInput(empty), 'Add a title, reflection, or photo to share this workout');

  const titleOnly = normalizeWorkoutStoryInput({ publicTitle: 'Showed up' });
  assert.equal(validateWorkoutStoryInput(titleOnly), null);
});

test('normalizeWorkoutStoryInput trims and caps fields', () => {
  const input = normalizeWorkoutStoryInput({
    publicTitle: '  My run  ',
    reflection: '  Felt honest  ',
    howFeltRating: 3,
    publish: true,
  });
  assert.equal(input.publicTitle, 'My run');
  assert.equal(input.reflection, 'Felt honest');
  assert.equal(input.howFeltRating, 3);
  assert.equal(input.publish, true);
});
