export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveRaceByCompanyRaceId } from "@/lib/race-hub-internal-company";
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from "@/lib/training/training-engine-auth";

/** GET — hub welcome profile (staff Firebase auth via Company proxy) */
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

    const profile = await prisma.race_hub_profiles.findUnique({
      where: { raceId: race.id },
    });

    return NextResponse.json({
      success: true,
      profile: profile
        ? {
            raceId: profile.raceId,
            welcomeText: profile.welcomeText,
            updatedAt: profile.updatedAt.toISOString(),
          }
        : { raceId: race.id, welcomeText: null, updatedAt: null },
    });
  } catch (err) {
    console.error("internal company hub profile GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PUT — upsert welcome text */
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
    const welcomeText =
      typeof body.welcomeText === "string" ? body.welcomeText.trim() : "";

    const profile = await prisma.race_hub_profiles.upsert({
      where: { raceId: race.id },
      create: {
        raceId: race.id,
        welcomeText: welcomeText || null,
      },
      update: {
        welcomeText: welcomeText || null,
      },
    });

    return NextResponse.json({
      success: true,
      profile: {
        raceId: profile.raceId,
        welcomeText: profile.welcomeText,
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("internal company hub profile PUT:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
