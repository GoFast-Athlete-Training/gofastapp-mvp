export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalApiKey } from "@/lib/internal-api-auth";

const BRAND_TYPES = ["SHOE", "APPAREL", "RUN_STORE_CHAIN", "GEAR", "OTHER"] as const;

function parseBrandType(v: unknown): (typeof BRAND_TYPES)[number] {
  if (typeof v === "string" && BRAND_TYPES.includes(v as (typeof BRAND_TYPES)[number])) {
    return v as (typeof BRAND_TYPES)[number];
  }
  return "OTHER";
}

type SnapBody = {
  brand?: {
    brandId?: string;
    slug?: string;
    name?: string;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    description?: string | null;
    brandType?: string | null;
  };
};

/**
 * POST /api/internal/brands/snap-sync
 * Machine lane: Sponsor Manage brandId → prod brands read snap (same id).
 */
export async function POST(request: NextRequest) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  let body: SnapBody;
  try {
    body = (await request.json()) as SnapBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body.brand;
  const brandId = b?.brandId?.trim();
  const slug = b?.slug?.trim().toLowerCase();
  const name = b?.name?.trim();

  if (!b || !brandId || !slug || !name) {
    return NextResponse.json(
      { success: false, error: "brand.brandId, brand.slug, and brand.name are required" },
      { status: 400 },
    );
  }

  const now = new Date();
  const brandType = parseBrandType(b.brandType);
  const description = b.description?.trim() || null;
  const websiteUrl = b.websiteUrl?.trim() || null;
  const logoUrl = b.logoUrl?.trim() || null;

  const slugTaken = await prisma.brands.findUnique({ where: { slug } });
  const slugUpdate =
    !slugTaken || slugTaken.id === brandId ? slug : undefined;

  const brand = await prisma.brands.upsert({
    where: { id: brandId },
    create: {
      id: brandId,
      slug,
      name,
      brandType,
      description,
      websiteUrl,
      logoUrl,
      syncedAt: now,
      updatedAt: now,
    },
    update: {
      name,
      brandType,
      description,
      websiteUrl,
      logoUrl,
      syncedAt: now,
      updatedAt: now,
      ...(slugUpdate ? { slug: slugUpdate } : {}),
    },
  });

  return NextResponse.json({ success: true, brand });
}
