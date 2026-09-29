export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  resolveGofastTenantCompanyId,
  searchSponsorManageBrands,
} from "@/lib/sponsor-manage-brand-client";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

/** GET /api/runmanage/brands/search?q= — staff proxy to Sponsor Manage brand catalog */
export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ success: false, error: "q is required" }, { status: 400 });
  }

  const result = await searchSponsorManageBrands({
    q,
    gofastCompanyId: resolveGofastTenantCompanyId(),
  });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true, brands: result.companies });
}
