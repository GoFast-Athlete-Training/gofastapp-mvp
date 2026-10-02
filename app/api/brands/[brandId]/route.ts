export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getProdBrandSnapById } from "@/lib/prod-brand-snap";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

/**
 * GET /api/brands/[brandId]
 * Staff lane: check whether the prod brand snap exists (same id as HQ / Sponsor Manage).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { brandId } = await params;
  const result = await getProdBrandSnapById(brandId);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, exists: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, exists: true, brand: result.brand });
}
