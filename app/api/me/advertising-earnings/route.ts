export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { fetchSurfaceOwnerEarnings } from "@/lib/advertising/advertiser-platform-client";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/me/advertising-earnings
 * Money curve for the authenticated athlete's published profile container surface.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await prisma.athlete.findFirst({
      where: { firebaseUid: decoded.uid },
      select: { id: true, isGoFastContainer: true, gofastHandle: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    if (!athlete.isGoFastContainer || !athlete.gofastHandle?.trim()) {
      return NextResponse.json({
        success: true,
        eligible: false,
        message: "Publish your GoFast profile container to appear in advertiser inventory.",
        earnings: null,
      });
    }

    const { searchParams } = new URL(request.url);
    const daysRaw = searchParams.get("days");
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 30;

    const earnings = await fetchSurfaceOwnerEarnings(
      athlete.id,
      Number.isFinite(days) ? days : 30
    );

    return NextResponse.json({
      success: true,
      eligible: true,
      handle: athlete.gofastHandle,
      earnings,
    });
  } catch (error: unknown) {
    console.error("[me/advertising-earnings]", error);
    return NextResponse.json({ error: "Failed to load earnings" }, { status: 500 });
  }
}
