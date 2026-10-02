export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { upsertProdBrandSnap } from "@/lib/prod-brand-snap";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

/**
 * POST /api/brands/snap-sync
 * Human lane: Company staff Bearer + x-gofast-staff-id writes the prod brand row (same id as Sponsor Manage).
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  let body: { brand?: Parameters<typeof upsertProdBrandSnap>[0] };
  try {
    body = (await request.json()) as { brand?: Parameters<typeof upsertProdBrandSnap>[0] };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.brand) {
    return NextResponse.json({ success: false, error: "brand payload is required" }, { status: 400 });
  }

  const result = await upsertProdBrandSnap(body.brand);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, brand: result.brand });
}
