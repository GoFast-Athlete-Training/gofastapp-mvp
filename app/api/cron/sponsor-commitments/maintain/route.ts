export const dynamic = "force-dynamic";

import {
  activateStartedSponsorCommitments,
  activateStartedSponsorships,
  expireEndedSponsorCommitments,
  finishEndedSponsorships,
} from "@/lib/sponsorship/sponsorship-service";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { NextRequest, NextResponse } from "next/server";

/** POST /api/cron/sponsor-commitments/maintain — transition live sponsorships and receipt statuses. */
export async function POST(request: NextRequest) {
  const authFailure = verifyCronSecret(request);
  if (authFailure) return authFailure;

  const now = new Date();
  const [
    sponsorshipsFinishedCount,
    sponsorshipsActivatedCount,
    expiredCount,
    activatedCount,
  ] = await Promise.all([
    finishEndedSponsorships(now),
    activateStartedSponsorships(now),
    expireEndedSponsorCommitments(now),
    activateStartedSponsorCommitments(now),
  ]);

  return NextResponse.json({
    success: true,
    sponsorshipsFinishedCount,
    sponsorshipsActivatedCount,
    expiredCount,
    activatedCount,
    processedAt: now.toISOString(),
  });
}
