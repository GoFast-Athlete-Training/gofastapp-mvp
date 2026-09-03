import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeWorkoutReflectionInput,
  normalizeWorkoutStoryInput,
  validateWorkoutReflectionInput,
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

test('normalizeWorkoutReflectionInput omits publish and howFelt fields', () => {
  const input = normalizeWorkoutReflectionInput({
    publicTitle: ' Sunrise miles ',
    reflection: ' Legs felt heavy ',
    workoutPhotoUrl: ' https://cdn.example/photo.jpg ',
  });
  assert.equal(input.publicTitle, 'Sunrise miles');
  assert.equal(input.reflection, 'Legs felt heavy');
  assert.equal(input.workoutPhotoUrl, 'https://cdn.example/photo.jpg');
  assert.equal(validateWorkoutReflectionInput(input), null);
});
