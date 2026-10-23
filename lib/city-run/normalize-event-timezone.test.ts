import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEventTimezoneInput,
  resolveEventTimezoneForWrite,
} from './normalize-event-timezone';

test('normalizeEventTimezoneInput maps EST and Eastern to America/New_York', () => {
  assert.equal(normalizeEventTimezoneInput('EST'), 'America/New_York');
  assert.equal(normalizeEventTimezoneInput('edt'), 'America/New_York');
  assert.equal(normalizeEventTimezoneInput('Eastern'), 'America/New_York');
});

test('resolveEventTimezoneForWrite falls back when blank', () => {
  assert.equal(resolveEventTimezoneForWrite(''), 'America/New_York');
  assert.equal(resolveEventTimezoneForWrite('EST'), 'America/New_York');
});
