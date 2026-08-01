export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { finalizePaidCommitment } from "@/lib/sponsorship/commitment-service";
import { NextRequest, NextResponse } from "next/server";

type FinalizePaidBody = {
  amountPaidCents?: number;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: string;
};

/** POST /api/sponsor-commitments/[id]/finalize-paid — idempotent paid activation from Company webhook */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ success: false, error: "Missing commitment id" }, { status: 400 });
  }

  let body: FinalizePaidBody = {};
  try {
    body = (await request.json()) as FinalizePaidBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.amountPaidCents !== "number" || body.amountPaidCents <= 0) {
    return NextResponse.json(
      { success: false, error: "amountPaidCents is required" },
      { status: 400 },
    );
  }

  try {
    const commitment = await finalizePaidCommitment({
      commitmentId: id.trim(),
      amountPaidCents: body.amountPaidCents,
      stripeCheckoutSessionId: body.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: body.stripePaymentIntentId ?? null,
      paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
    });

    return NextResponse.json({
      success: true,
      commitment: {
        id: commitment.id,
        paymentStatus: commitment.paymentStatus,
        status: commitment.status,
        paidAt: commitment.paidAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finalization failed";
    const status = message.includes("not eligible") ? 409 : 500;
    console.error("POST /api/sponsor-commitments/[id]/finalize-paid:", error);
    return NextResponse.json({ success: false, error: message, retryable: status === 500 }, { status });
  }
}
