export const dynamic = "force-dynamic";

import {
  assertBrandBearerAuth,
  getForwardedBrandId,
  getForwardedBrandUserId,
} from "@/lib/sponsorship/brand-partnership-auth";
import {
  attachCheckoutSessionToCommitment,
  createCheckoutPendingCommitment,
} from "@/lib/sponsorship/commitment-service";
import { NextRequest, NextResponse } from "next/server";

type CreateCommitmentBody = {
  candidateId?: string;
  candidateCode?: string;
  brandId?: string;
  brandUserId?: string;
  brandNameSnapshot?: string;
  brandLogoUrlSnapshot?: string;
  creativeUrl?: string;
  ctaUrl?: string;
  startsAt?: string;
  endsAt?: string;
  pricingRuleKey?: string;
  pricingRuleVersion?: number;
  pricingBreakdownJson?: unknown;
  quotedAmountCents?: number;
  currency?: string;
  athleteShareCents?: number;
  platformShareCents?: number;
  stripeCheckoutSessionId?: string;
};

/** POST /api/sponsor-commitments — Brand proxy creates CHECKOUT_PENDING row */
export async function POST(request: NextRequest) {
  const authError = await assertBrandBearerAuth(request);
  if (authError) return authError;

  const headerBrandUserId = getForwardedBrandUserId(request);
  const headerBrandId = getForwardedBrandId(request);

  let body: CreateCommitmentBody;
  try {
    body = (await request.json()) as CreateCommitmentBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.brandUserId?.trim() && body.brandUserId.trim() !== headerBrandUserId) {
    return NextResponse.json({ success: false, error: "brandUserId mismatch" }, { status: 403 });
  }
  if (body.brandId?.trim() && body.brandId.trim() !== headerBrandId) {
    return NextResponse.json({ success: false, error: "brandId mismatch" }, { status: 403 });
  }

  const {
    candidateId,
    candidateCode,
    startsAt,
    endsAt,
    pricingRuleKey,
    quotedAmountCents,
  } = body;

  if (
    !candidateId?.trim() ||
    !candidateCode?.trim() ||
    !headerBrandId ||
    !headerBrandUserId ||
    !startsAt ||
    !endsAt ||
    !pricingRuleKey?.trim() ||
    typeof quotedAmountCents !== "number"
  ) {
    return NextResponse.json(
      { success: false, error: "Missing required commitment fields" },
      { status: 400 },
    );
  }

  try {
    const commitment = await createCheckoutPendingCommitment({
      candidateId: candidateId.trim(),
      candidateCode: candidateCode.trim(),
      brandId: headerBrandId,
      brandUserId: headerBrandUserId,
      brandNameSnapshot: body.brandNameSnapshot ?? null,
      brandLogoUrlSnapshot: body.brandLogoUrlSnapshot ?? null,
      creativeUrl: body.creativeUrl ?? null,
      ctaUrl: body.ctaUrl ?? null,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      pricingRuleKey: pricingRuleKey.trim(),
      pricingRuleVersion: body.pricingRuleVersion ?? 1,
      pricingBreakdownJson: body.pricingBreakdownJson,
      quotedAmountCents,
      currency: body.currency,
      athleteShareCents: body.athleteShareCents ?? null,
      platformShareCents: body.platformShareCents ?? null,
      stripeCheckoutSessionId: body.stripeCheckoutSessionId ?? null,
    });

    if (body.stripeCheckoutSessionId?.trim()) {
      await attachCheckoutSessionToCommitment(
        commitment.id,
        body.stripeCheckoutSessionId.trim(),
      );
    }

    return NextResponse.json({
      success: true,
      commitment: {
        id: commitment.id,
        paymentStatus: commitment.paymentStatus,
        status: commitment.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commitment creation failed";
    const status =
      message.includes("not eligible") ||
      message.includes("overlapping") ||
      message.includes("mismatch")
        ? 409
        : 500;
    console.error("POST /api/sponsor-commitments:", error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
