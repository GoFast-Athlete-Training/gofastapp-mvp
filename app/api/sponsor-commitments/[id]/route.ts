export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { getCommitmentById } from "@/lib/sponsorship/commitment-service";
import { NextRequest, NextResponse } from "next/server";

/** GET /api/sponsor-commitments/[id] — read commitment payment/runtime state */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ success: false, error: "Missing commitment id" }, { status: 400 });
  }

  const commitment = await getCommitmentById(id.trim());
  if (!commitment) {
    return NextResponse.json({ success: false, error: "Commitment not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    commitment: {
      id: commitment.id,
      paymentStatus: commitment.paymentStatus,
      status: commitment.status,
      amountPaidCents: commitment.amountPaidCents,
      paidAt: commitment.paidAt?.toISOString() ?? null,
      startsAt: commitment.startsAt.toISOString(),
      endsAt: commitment.endsAt.toISOString(),
    },
  });
}
