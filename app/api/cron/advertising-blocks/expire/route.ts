export const dynamic = "force-dynamic";

import {
  activateStartedAdvertisingBlocks,
  expireEndedAdvertisingBlocks,
} from "@/lib/advertising/block-service";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { NextRequest, NextResponse } from "next/server";

/** POST /api/cron/advertising-blocks/expire — transition ended blocks to EXPIRED. */
export async function POST(request: NextRequest) {
  const authFailure = verifyCronSecret(request);
  if (authFailure) return authFailure;

  const now = new Date();
  const [expiredCount, activatedCount] = await Promise.all([
    expireEndedAdvertisingBlocks(now),
    activateStartedAdvertisingBlocks(now),
  ]);

  return NextResponse.json({
    success: true,
    expiredCount,
    activatedCount,
    processedAt: now.toISOString(),
  });
}
