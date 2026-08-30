export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { deleteAthleteAccount } from "@/lib/domain-athlete";
import { prisma } from "@/lib/prisma";
import {
  isPrismaPoolTimeout,
  touchAthleteLastSeenIfStale,
} from "@/lib/touch-athlete-last-seen";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

/** GET /api/athlete/me — resolve Firebase token to DB athlete id (welcome gate) */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
  }

  try {
    const athlete = await prisma.athlete.findUnique({
      where: { firebaseId: decoded.uid },
      select: { id: true, lastSeenAt: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    await touchAthleteLastSeenIfStale(athlete.id, athlete.lastSeenAt);
    return NextResponse.json({ success: true, athleteId: athlete.id });
  } catch (err) {
    console.error("GET /api/athlete/me DB error:", err);
    if (isPrismaPoolTimeout(err)) {
      return NextResponse.json(
        { success: false, error: "Database busy, try again", retryable: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });
  }
}

/** DELETE /api/athlete/me — self-service account deletion (App Store compliance) */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    await deleteAthleteAccount(auth.athlete.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Account deletion failed";
    console.error("DELETE /api/athlete/me", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
