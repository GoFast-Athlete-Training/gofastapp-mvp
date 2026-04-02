import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/race-registry/public/by-company-id/[companyRaceId]
 * Resolves GoFastCompany races.id → gofastapp-mvp race_registry.id for public CTAs.
 * No auth.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyRaceId: string }> }
) {
  try {
    const { companyRaceId } = await params;
    const id = companyRaceId?.trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "companyRaceId is required" },
        { status: 400 }
      );
    }

    const row = await prisma.race_registry.findFirst({
      where: {
        companyRaceId: id,
        isActive: true,
        isCancelled: false,
      },
      select: { id: true },
    });

    if (!row) {
      return NextResponse.json(
        { success: false, error: "Race not in registry" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      raceRegistryId: row.id,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[race-registry/public/by-company-id]", error);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to resolve race",
      },
      { status: 500 }
    );
  }
}
