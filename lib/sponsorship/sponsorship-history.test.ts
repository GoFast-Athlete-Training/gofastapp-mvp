import assert from 'node:assert/strict';
import test from 'node:test';
import type { AthleteSponsorshipHistoryRow } from './sponsorship-service';
import { SponsorshipDeliveryStatus } from '@prisma/client';

test('AthleteSponsorshipHistoryRow carries hydration and receipt money fields', () => {
  const row: AthleteSponsorshipHistoryRow = {
    sponsorshipId: 'sponsorship_1',
    commitmentId: 'commit_1',
    brandId: 'brand_1',
    brandNameSnapshot: 'Acme Running',
    brandLogoUrlSnapshot: null,
    creativeUrl: null,
    ctaUrl: null,
    startsAt: '2026-08-01T00:00:00.000Z',
    endsAt: '2026-08-31T00:00:00.000Z',
    deliveryStatus: SponsorshipDeliveryStatus.LIVE,
    cpmAmount: 500,
    cpmUsed: 12,
    amountPaidCents: 5000,
    athleteShareCents: 4000,
    paidAt: '2026-08-01T12:00:00.000Z',
  };

  assert.equal(row.commitmentId, 'commit_1');
  assert.equal(row.brandId, 'brand_1');
  assert.equal(row.athleteShareCents, 4000);
  assert.equal(row.cpmAmount, 500);
});
