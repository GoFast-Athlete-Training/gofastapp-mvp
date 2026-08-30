import assert from 'node:assert/strict';
import test from 'node:test';

import { isPrismaPoolTimeout } from './touch-athlete-last-seen';

test('isPrismaPoolTimeout detects P2024', () => {
  assert.equal(isPrismaPoolTimeout({ code: 'P2024' }), true);
  assert.equal(isPrismaPoolTimeout({ code: 'P2002' }), false);
  assert.equal(isPrismaPoolTimeout(null), false);
  assert.equal(isPrismaPoolTimeout('timeout'), false);
});
