import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebaseAdmin";

/**
 * Server-to-server: list race_registry rows with companyRaceId null.
 *
 * Auth: same as GET /api/run-series/[id] — Firebase Bearer only (Company forwards
 * the staff token + cookie like race prodpush).
 */
export async function raceRegistryUnlinkedListGET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const races = await prisma.race_registry.findMany({
      where: { companyRaceId: null },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        raceDate: true,
        registrationUrl: true,
        officialWebsiteUrl: true,
        distanceMeters: true,
        distanceLabel: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, races });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("race-registry unlinked list:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to list unlinked registry races",
        details: err?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
