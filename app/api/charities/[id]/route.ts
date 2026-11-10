export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getProdCharitySnapById } from "@/lib/prod-charity-snap";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

/**
 * GET /api/charities/[id]
 * Staff lane: check whether the prod charity catalog row exists (same id as Race Manage).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const result = await getProdCharitySnapById(id);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, exists: false, error: result.error },
      { status: result.status },
    );
  }

  if (!result.exists) {
    return NextResponse.json({ success: true, exists: false, charity: null });
  }

  return NextResponse.json({ success: true, exists: true, charity: result.charity });
}
