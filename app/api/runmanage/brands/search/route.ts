export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  resolveGofastTenantCompanyId,
  searchSponsorManageBrands,
} from "@/lib/sponsor-manage-brand-client";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";

/** GET /api/runmanage/brands/search?q= — staff proxy to Sponsor Manage brand catalog */
export async function GET(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

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
