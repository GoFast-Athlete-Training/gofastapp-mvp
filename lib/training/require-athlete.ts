import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteById } from "@/lib/domain-athlete";
import { ATHLETE_ID_HEADER } from "@/lib/gofast-request-headers";

/**
 * Resolve the signed-in athlete: Firebase JWT proves identity; x-athlete-id is PK lookup (no firebaseId scan).
 */
export async function requireAthleteFromBearer(request: Request) {
  const athleteId = request.headers.get(ATHLETE_ID_HEADER)?.trim();
  if (!athleteId) {
    return {
      error: "Missing athlete session header" as const,
      status: 400 as const,
    };
  }

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

  const athlete = await getAthleteById(athleteId);
  if (!athlete) {
    return { error: "Athlete not found" as const, status: 404 as const };
  }

  if (athlete.firebaseId !== decoded.uid) {
    return { error: "Forbidden" as const, status: 403 as const };
  }

  return { athlete };
}
