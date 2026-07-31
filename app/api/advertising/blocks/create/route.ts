export const dynamic = "force-dynamic";

import { createAdvertisingBlockFromPurchase } from "@/lib/advertising/block-service";
import { fetchBrandPurchaseSnapshot } from "@/lib/advertising/brand-purchase-client";
import { adminAuth } from "@/lib/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";

type CreateBlockBody = {
  sourcePurchaseId?: string;
  brandCampaignId?: string;
};

/**
 * POST /api/advertising/blocks/create
 * Firebase-verified idempotent block creation from Brand purchase snapshot.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
  }

  let body: CreateBlockBody;
  try {
    body = (await request.json()) as CreateBlockBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sourcePurchaseId = body.sourcePurchaseId?.trim() || body.brandCampaignId?.trim();
  if (!sourcePurchaseId) {
    return NextResponse.json(
      { success: false, error: "sourcePurchaseId is required" },
      { status: 400 },
    );
  }

  try {
    const snapshot = await fetchBrandPurchaseSnapshot(sourcePurchaseId, authHeader.substring(7));
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: "Purchase snapshot not found or not authorized" },
        { status: 404 },
      );
    }

    const block = await createAdvertisingBlockFromPurchase({
      sourcePurchaseId,
      candidateId: snapshot.advertisingCandidateId,
      candidateCode: snapshot.advertisingCandidateCode,
      advertiserCompanyId: snapshot.advertiserCompanyId,
      advertiserCompanyName: snapshot.advertiserCompanyName,
      amountCents: snapshot.amountCents,
      currency: snapshot.currency,
      purchasedAt: snapshot.purchasedAt ? new Date(snapshot.purchasedAt) : new Date(),
      startsAt: new Date(snapshot.startsAt),
      endsAt: new Date(snapshot.endsAt),
      creative: {
        creativeId: snapshot.creativeId,
        creativeName: snapshot.creativeName,
        brandCampaignCollateralUrl: snapshot.brandCampaignCollateralUrl,
        ctaUrl: snapshot.ctaUrl,
        ctaLabel: snapshot.ctaLabel,
        altText: snapshot.altText,
      },
    });

    return NextResponse.json({
      success: true,
      block: {
        id: block.id,
        sourcePurchaseId: block.sourcePurchaseId,
        candidateId: block.candidateId,
        status: block.status,
        startsAt: block.startsAt.toISOString(),
        endsAt: block.endsAt.toISOString(),
      },
      verifiedBy: decodedToken.uid,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Block creation failed";
    const status =
      message.includes("not eligible") ||
      message.includes("overlapping") ||
      message.includes("mismatch")
        ? 409
        : 500;
    console.error("POST /api/advertising/blocks/create:", error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
