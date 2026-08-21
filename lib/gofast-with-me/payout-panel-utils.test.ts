import assert from 'node:assert/strict';
import test from 'node:test';
import {
  connectStatusBadgeClass,
  formatUsdFromCents,
} from './payout-panel-utils';

test('formatUsdFromCents formats athlete share amounts', () => {
  assert.equal(formatUsdFromCents(3500), '$35.00');
  assert.equal(formatUsdFromCents(0), '$0.00');
});

test('connectStatusBadgeClass highlights ready and action-required states', () => {
  assert.match(connectStatusBadgeClass('payouts_ready', true), /emerald/);
  assert.match(connectStatusBadgeClass('action_required', false), /amber/);
  assert.match(connectStatusBadgeClass('setup_required', false), /gray/);
});
