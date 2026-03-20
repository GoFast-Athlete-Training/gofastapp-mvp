import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";

export async function requireAthleteFromBearer(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized" as const, status: 401 as const };
  }
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return { error: "Invalid token" as const, status: 401 as const };
  }
  const athlete = await getAthleteByFirebaseId(decoded.uid);
  if (!athlete) {
    return { error: "Athlete not found" as const, status: 404 as const };
  }
  return { athlete };
}
