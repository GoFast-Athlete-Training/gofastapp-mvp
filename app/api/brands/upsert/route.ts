import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NEXT_PUBLIC_COMPANY_APP_URL || "https://gofasthq.gofastcrushgoals.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const BRAND_TYPES = ["SHOE", "APPAREL", "RUN_STORE_CHAIN", "GEAR", "OTHER"] as const;

function parseBrandType(v: unknown): (typeof BRAND_TYPES)[number] {
  if (typeof v === "string" && BRAND_TYPES.includes(v as (typeof BRAND_TYPES)[number])) {
    return v as (typeof BRAND_TYPES)[number];
  }
  return "OTHER";
}

/**
 * POST /api/brands/upsert — prodpush from GoFastCompany acq_brands (slug bridge).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const b = body.brand as Record<string, unknown> | undefined;
    if (!b || typeof b !== "object") {
      return NextResponse.json(
        { success: false, error: "brand payload is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const slug =
      b.slug != null && String(b.slug).trim() ? String(b.slug).trim().toLowerCase() : "";
    if (!slug) {
      return NextResponse.json(
        { success: false, error: "brand.slug is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const name =
      b.name != null && String(b.name).trim() ? String(b.name).trim() : "Unnamed brand";

    const brandType = parseBrandType(b.brandType);
    const description =
      b.description != null && String(b.description).trim()
        ? String(b.description).trim()
        : null;
    const websiteUrl =
      b.websiteUrl != null && String(b.websiteUrl).trim()
        ? String(b.websiteUrl).trim()
        : null;
    const instagramHandle =
      b.instagramHandle != null && String(b.instagramHandle).trim()
        ? String(b.instagramHandle).trim()
        : null;
    const logoUrl =
      b.logoUrl != null && String(b.logoUrl).trim() ? String(b.logoUrl).trim() : null;

    const now = new Date();
    const existing = await prisma.brands.findUnique({ where: { slug } });
    const brand = existing
      ? await prisma.brands.update({
          where: { slug },
          data: {
            name,
            brandType,
            description,
            websiteUrl,
            instagramHandle,
            logoUrl,
            syncedAt: now,
            updatedAt: now,
          },
        })
      : await prisma.brands.create({
          data: {
            slug,
            name,
            brandType,
            description,
            websiteUrl,
            instagramHandle,
            logoUrl,
            syncedAt: now,
            updatedAt: now,
          },
        });

    const response = NextResponse.json({ success: true, brand });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[brands/upsert]", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Failed to upsert brand" },
      { status: 500, headers: corsHeaders }
    );
  }
}
