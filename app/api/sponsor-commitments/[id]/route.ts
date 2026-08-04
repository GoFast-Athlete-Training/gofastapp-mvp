export const dynamic = "force-dynamic";

import {
  assertBrandBearerAuth,
  getForwardedBrandId,
  getForwardedBrandUserId,
} from "@/lib/sponsorship/brand-partnership-auth";
import {
  getCommitmentByIdWithCandidate,
  listCommitmentsForBrand,
} from "@/lib/sponsorship/commitment-service";
import { NextRequest, NextResponse } from "next/server";

/** GET /api/sponsor-commitments/[id] — brand-scoped commitment status hydration */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await assertBrandBearerAuth(request);
  if (authError) return authError;

  const brandId = getForwardedBrandId(request);
  const brandUserId = getForwardedBrandUserId(request);
  const { id } = await params;

  if (!id?.trim()) {
    return NextResponse.json({ success: false, error: "Missing commitment id" }, { status: 400 });
  }

  const commitment = await getCommitmentByIdWithCandidate(id.trim());
  if (!commitment) {
    return NextResponse.json({ success: false, error: "Commitment not found" }, { status: 404 });
  }

  if (commitment.brandId !== brandId || commitment.brandUserId !== brandUserId) {
    return NextResponse.json({ success: false, error: "Commitment not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    commitment,
  });
}
