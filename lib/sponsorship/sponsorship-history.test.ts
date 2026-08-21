import assert from 'node:assert/strict';
import test from 'node:test';
import { mapSponsorshipHistoryRow } from './commitment-service';
import {
  SponsorCommitmentPaymentStatus,
  SponsorCommitmentStatus,
} from '@prisma/client';

test('mapSponsorshipHistoryRow includes snapshotted athleteShareCents', () => {
  const paidAt = new Date('2026-08-01T12:00:00.000Z');
  const startsAt = new Date('2026-08-01T00:00:00.000Z');
  const endsAt = new Date('2026-08-31T00:00:00.000Z');

  const row = mapSponsorshipHistoryRow({
    id: 'commit_1',
    brandNameSnapshot: 'Acme Running',
    brandLogoUrlSnapshot: null,
    creativeUrl: null,
    ctaUrl: null,
    startsAt,
    endsAt,
    status: SponsorCommitmentStatus.ACTIVE,
    paymentStatus: SponsorCommitmentPaymentStatus.PAID,
    amountPaidCents: 5000,
    athleteShareCents: 4000,
    paidAt,
  });

  assert.equal(row.commitmentId, 'commit_1');
  assert.equal(row.athleteShareCents, 4000);
  assert.equal(row.paidAt, paidAt.toISOString());
  assert.equal(row.brandNameSnapshot, 'Acme Running');
});
