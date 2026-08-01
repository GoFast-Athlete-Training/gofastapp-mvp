export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { attachCheckoutSessionToCommitment } from "@/lib/sponsorship/commitment-service";
import { NextRequest, NextResponse } from "next/server";

/** POST /api/sponsor-commitments/[id]/checkout-session — attach Stripe Checkout session id */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  const { id } = await params;
  let body: { stripeCheckoutSessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.stripeCheckoutSessionId?.trim()) {
    return NextResponse.json(
      { success: false, error: "stripeCheckoutSessionId is required" },
      { status: 400 },
    );
  }

  const commitment = await attachCheckoutSessionToCommitment(
    id.trim(),
    body.stripeCheckoutSessionId.trim(),
  );

  return NextResponse.json({
    success: true,
    commitment: {
      id: commitment.id,
      stripeCheckoutSessionId: commitment.stripeCheckoutSessionId,
      paymentStatus: commitment.paymentStatus,
    },
  });
}
