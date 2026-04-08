export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/race-hub/public/resolve-by-company-race/[companyRaceId]
 * Maps GoFastCompany races.id → race_registry row (for public slug pages).
 * No auth — only returns minimal safe fields.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyRaceId: string }> }
) {
  try {
    const { companyRaceId } = await params;
    if (!companyRaceId?.trim()) {
      return NextResponse.json({ success: false, error: "companyRaceId required" }, { status: 400 });
    }

    const race = await prisma.race_registry.findFirst({
      where: {
        companyRaceId: companyRaceId.trim(),
        isActive: true,
        isCancelled: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        companyRaceId: true,
      },
    });

    if (!race) {
      return NextResponse.json({ success: false, error: "Race not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      registryId: race.id,
      name: race.name,
      slug: race.slug,
      companyRaceId: race.companyRaceId,
    });
  } catch (err) {
    console.error("resolve-by-company-race:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
