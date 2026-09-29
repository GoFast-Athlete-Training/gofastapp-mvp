export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  resolveGofastTenantCompanyId,
  upsertSponsorManageBrand,
} from "@/lib/sponsor-manage-brand-client";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

type CreateBody = {
  name?: string;
  slug?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  brandType?: string | null;
};

/** POST /api/runmanage/brands — create brand in Sponsor Manage (snap fan-out from GSM) */
export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const gofastCompanyId = resolveGofastTenantCompanyId();
  if (!gofastCompanyId) {
    return NextResponse.json(
      { success: false, error: "GOFAST_GO_FAST_COMPANY_ID is not configured" },
      { status: 503 },
    );
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
  }

  const result = await upsertSponsorManageBrand({
    gofastCompanyId,
    name,
    slug: body.slug ?? null,
    websiteUrl: body.websiteUrl ?? null,
    logoUrl: body.logoUrl ?? null,
    description: body.description ?? null,
    brandType: body.brandType ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true, brand: result.company, brandId: result.company.id });
}
