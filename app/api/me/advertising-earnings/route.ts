export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { fetchAthleteSponsorshipEarningsFromSponsorManage } from "@/lib/advertising/sponsor-manage-client";
import { getAthleteConnectStatus, athleteConnectStatusSelect } from "@/lib/sponsorship/athlete-stripe-connect-service";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/me/advertising-earnings
 * Sponsorship totals come from Sponsor Manage. Placement spend is not loaded here.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await prisma.athlete.findFirst({
      where: { firebaseId: decoded.uid },
      select: {
        id: true,
        gofastHandle: true,
        ...athleteConnectStatusSelect,
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    if (!athlete.gofastHandle?.trim()) {
      return NextResponse.json({
        success: true,
        eligible: false,
        message: "Set your GoFast handle to publish a public page brands can target.",
        earnings: null,
      });
    }

    const [sponsorshipEarnings, connectStatus] = await Promise.all([
      fetchAthleteSponsorshipEarningsFromSponsorManage(athlete.id, authHeader),
      getAthleteConnectStatus(athlete),
    ]);

    return NextResponse.json({
      success: true,
      eligible: true,
      handle: athlete.gofastHandle,
      earnings: null,
      sponsorshipEarnings,
      connectStatus,
    });
  } catch (error: unknown) {
    console.error("[me/advertising-earnings]", error);
    return NextResponse.json({ error: "Failed to load earnings" }, { status: 500 });
  }
}
