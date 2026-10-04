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

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * POST /api/run-stores/upsert — prodpush from GoFastCompany acq_run_stores (id bridge).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const s = body.store as Record<string, unknown> | undefined;
    if (!s || typeof s !== "object") {
      return NextResponse.json(
        { success: false, error: "store payload is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const id = s.id != null && String(s.id).trim() ? String(s.id).trim() : "";
    if (!id) {
      return NextResponse.json(
        { success: false, error: "store.id is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const name =
      s.name != null && String(s.name).trim() ? String(s.name).trim() : "Unnamed store";
    const slugRaw =
      s.slug != null && String(s.slug).trim()
        ? String(s.slug).trim().toLowerCase()
        : slugify(name) || id.slice(0, 12);
    const slug = slugRaw.slice(0, 64);

    const websiteUrl =
      s.websiteUrl != null && String(s.websiteUrl).trim()
        ? String(s.websiteUrl).trim()
        : null;
    const logoUrl =
      s.logoUrl != null && String(s.logoUrl).trim() ? String(s.logoUrl).trim() : null;
    const city = s.city != null && String(s.city).trim() ? String(s.city).trim() : null;
    const state = s.state != null && String(s.state).trim() ? String(s.state).trim() : null;
    const formattedAddress =
      s.formattedAddress != null && String(s.formattedAddress).trim()
        ? String(s.formattedAddress).trim()
        : null;
    const brandId =
      s.brandId != null && String(s.brandId).trim() ? String(s.brandId).trim() : null;

    const now = new Date();
    const store = await prisma.run_stores.upsert({
      where: { id },
      create: {
        id,
        brandId,
        slug,
        name,
        websiteUrl,
        logoUrl,
        city,
        state,
        formattedAddress,
        syncedAt: now,
        updatedAt: now,
      },
      update: {
        brandId,
        slug,
        name,
        websiteUrl,
        logoUrl,
        city,
        state,
        formattedAddress,
        syncedAt: now,
        updatedAt: now,
      },
    });

    const response = NextResponse.json({ success: true, store });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[run-stores/upsert]", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Failed to upsert run store" },
      { status: 500, headers: corsHeaders }
    );
  }
}
