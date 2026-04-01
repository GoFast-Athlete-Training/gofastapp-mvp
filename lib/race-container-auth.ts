import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";

export type RaceContainerAuthOk = { athlete: NonNullable<Awaited<ReturnType<typeof getAthleteByFirebaseId>>> };
export type RaceContainerAuthErr = { error: string; status: number };

/**
 * Firebase Bearer-only auth (same pattern as run crew message routes).
 * Use for race container endpoints on the public web / cross-origin clients.
 */
export async function getAthleteFromBearer(request: Request): Promise<RaceContainerAuthOk | RaceContainerAuthErr> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return { error: "Invalid token", status: 401 };
  }

  let athlete;
  try {
    athlete = await getAthleteByFirebaseId(decodedToken.uid);
  } catch (err) {
    console.error("race-container-auth DB error:", err);
    return { error: "Database error", status: 500 };
  }

  if (!athlete) {
    return { error: "Athlete not found", status: 404 };
  }

  return { athlete };
}
