export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { deleteAthleteAccount, getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

/** GET /api/athlete/me — resolve Firebase token to DB athlete id (welcome gate) */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decoded.uid);
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, athleteId: athlete.id });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
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
