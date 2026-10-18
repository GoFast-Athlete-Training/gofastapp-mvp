export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveRaceByCompanyRaceId } from "@/lib/race-hub-internal-company";
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from "@/lib/training/training-engine-auth";

/** GET — hub welcome copy lives on race_registry.description */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyRaceId: string }> },
) {
  try {
    const unauthorized = await assertStaffBearerAuth(request);
    if (unauthorized) return unauthorized;

    const { companyRaceId } = await params;
    if (!companyRaceId?.trim()) {
      return NextResponse.json({ error: "companyRaceId required" }, { status: 400 });
    }

    const race = await resolveActiveRaceByCompanyRaceId(companyRaceId);
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const row = await prisma.race_registry.findUnique({
      where: { id: race.id },
      select: { id: true, description: true, summaryPhrase: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      registry: row
        ? {
            raceId: row.id,
            description: row.description,
            summaryPhrase: row.summaryPhrase,
            updatedAt: row.updatedAt.toISOString(),
          }
        : {
            raceId: race.id,
            description: null,
            summaryPhrase: null,
            updatedAt: null,
          },
    });
  } catch (err) {
    console.error("internal company registry-description GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PUT — update standing hub welcome (race_registry.description) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyRaceId: string }> },
) {
  try {
    const unauthorized = await assertStaffBearerAuth(request);
    if (unauthorized) return unauthorized;

    const staffGeneratedId = getForwardedStaffId(request);
    if (!staffGeneratedId) {
      return NextResponse.json({ error: "Missing staff id" }, { status: 401 });
    }

    const { companyRaceId } = await params;
    if (!companyRaceId?.trim()) {
      return NextResponse.json({ error: "companyRaceId required" }, { status: 400 });
    }

    const race = await resolveActiveRaceByCompanyRaceId(companyRaceId);
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    const updated = await prisma.race_registry.update({
      where: { id: race.id },
      data: { description: description || null },
      select: { id: true, description: true, summaryPhrase: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      registry: {
        raceId: updated.id,
        description: updated.description,
        summaryPhrase: updated.summaryPhrase,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("internal company registry-description PUT:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
