export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { patchSponsorManageBrand } from "@/lib/sponsor-manage-brand-client";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";

type PatchBody = {
  name?: string;
  slug?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  brandType?: string | null;
};

/** PATCH /api/runmanage/brands/[brandId] — edit brand in Sponsor Manage (snap fan-out) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { brandId } = await params;
  if (!brandId?.trim()) {
    return NextResponse.json({ success: false, error: "brandId required" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (auth.mode !== "staff") {
    return NextResponse.json(
      { success: false, error: "Staff session required to edit brands" },
      { status: 403 },
    );
  }

  const result = await patchSponsorManageBrand(request, auth.staffId, brandId.trim(), body);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true, brand: result.brand, brandId: result.brand.id });
}
