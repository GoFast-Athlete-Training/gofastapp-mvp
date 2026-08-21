export const dynamic = "force-dynamic";

import {
  assertBrandBearerAuth,
  getForwardedBrandId,
  getForwardedBrandUserId,
} from "@/lib/sponsorship/brand-partnership-auth";
import { getCommitmentById } from "@/lib/sponsorship/commitment-service";
import { NextRequest, NextResponse } from "next/server";

/** GET /api/sponsor-commitments/[id]/checkout-context — brand-scoped checkout prerequisites */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await assertBrandBearerAuth(request);
  if (authError) return authError;

  const brandId = getForwardedBrandId(request);
  const brandUserId = getForwardedBrandUserId(request);
  if (!brandId || !brandUserId) {
    return NextResponse.json({ success: false, error: "Missing brand scope" }, { status: 400 });
  }

  const { id } = await params;
  const commitment = await getCommitmentById(id.trim());
  if (!commitment || commitment.brandId !== brandId || commitment.brandUserId !== brandUserId) {
    return NextResponse.json({ success: false, error: "Commitment not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    stripeConnectAccountId: commitment.stripeConnectAccountId,
    payoutConfigKey: commitment.payoutConfigKey,
    payoutConfigVersion: commitment.payoutConfigVersion,
    athleteSharePercent: commitment.athleteSharePercent,
    platformSharePercent: commitment.platformSharePercent,
  });
}
