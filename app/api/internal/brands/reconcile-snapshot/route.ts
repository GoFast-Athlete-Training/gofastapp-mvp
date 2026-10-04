export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { listProdBrandsForReconcile } from "@/lib/prod-brand-snap";

/** GET /api/internal/brands/reconcile-snapshot — machine lane brand rows for cron reconcile. */
export async function GET(request: NextRequest) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  const sinceRaw = request.nextUrl.searchParams.get("since")?.trim();
  let since: Date | undefined;
  if (sinceRaw) {
    const parsed = new Date(sinceRaw);
    if (!Number.isNaN(parsed.getTime())) since = parsed;
  }

  const rows = await listProdBrandsForReconcile(since);
  return NextResponse.json({
    success: true,
    brands: rows.map((row) => ({
      brandId: row.id,
      updatedAt: row.updatedAt.toISOString(),
      brand: {
        brandId: row.id,
        slug: row.slug,
        name: row.name,
        logoUrl: row.logoUrl,
        websiteUrl: row.websiteUrl,
        description: row.description,
        brandType: row.brandType,
        instagramHandle: row.instagramHandle,
        city: row.city,
        state: row.state,
        yearFounded: row.yearFounded,
        otherLocations: row.otherLocations,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
      },
    })),
  });
}
