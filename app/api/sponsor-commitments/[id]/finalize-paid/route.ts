export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/** POST /api/sponsor-commitments/[id]/finalize-paid — retired; Stripe webhook is canonical */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Paid activation is handled by POST /api/stripe/webhook after Stripe checkout",
    },
    { status: 410 },
  );
}
