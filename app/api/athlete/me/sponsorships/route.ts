export const dynamic = "force-dynamic";

import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { listAthleteSponsorshipHistory } from "@/lib/sponsorship/commitment-service";
import { NextRequest, NextResponse } from "next/server";

/** GET /api/athlete/me/sponsorships — paid sponsorship history for authenticated athlete */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
  }

  const athlete = await getAthleteByFirebaseId(decodedToken.uid);
  if (!athlete) {
    return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
  }

  const sponsorships = await listAthleteSponsorshipHistory(athlete.id);
  return NextResponse.json({ success: true, sponsorships });
}
