export const dynamic = "force-dynamic";

import {
  activateStartedSponsorCommitments,
  expireEndedSponsorCommitments,
} from "@/lib/sponsorship/commitment-service";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { NextRequest, NextResponse } from "next/server";

/** POST /api/cron/sponsor-commitments/maintain — transition ended commitments to EXPIRED. */
export async function POST(request: NextRequest) {
  const authFailure = verifyCronSecret(request);
  if (authFailure) return authFailure;

  const now = new Date();
  const [expiredCount, activatedCount] = await Promise.all([
    expireEndedSponsorCommitments(now),
    activateStartedSponsorCommitments(now),
  ]);

  return NextResponse.json({
    success: true,
    expiredCount,
    activatedCount,
    processedAt: now.toISOString(),
  });
}
