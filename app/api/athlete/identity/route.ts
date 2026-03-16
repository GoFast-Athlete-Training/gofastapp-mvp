export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";

/**
 * POST /api/athlete/identity
 * Identity-for-other-apps endpoint: returns minimal athlete identity only.
 * Used by external apps (e.g. LevelUp) to sync identity without depending on hydrate.
 * Contract: stable identity fields only; no run crews, company, or activities.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let firebaseId: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    firebaseId = decoded.uid;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid token";
    return NextResponse.json(
      { success: false, error: "Invalid token", details: message },
      { status: 401 }
    );
  }

  let athlete;
  try {
    athlete = await getAthleteByFirebaseId(firebaseId);
  } catch {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  if (!athlete) {
    return NextResponse.json(
      { success: false, error: "Athlete not found" },
      { status: 404 }
    );
  }

  const identity = {
    id: athlete.id,
    email: athlete.email ?? null,
    firstName: athlete.firstName ?? null,
    lastName: athlete.lastName ?? null,
    photoURL: athlete.photoURL ?? null,
    bio: athlete.bio ?? null,
    city: athlete.city ?? null,
    state: athlete.state ?? null,
    phoneNumber: athlete.phoneNumber ?? null,
    instagram: athlete.instagram ?? null,
  };

  return NextResponse.json({ success: true, identity });
}
