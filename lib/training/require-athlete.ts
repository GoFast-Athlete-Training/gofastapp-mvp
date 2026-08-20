import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId, getAthleteById } from "@/lib/domain-athlete";
import { ATHLETE_ID_HEADER } from "@/lib/gofast-request-headers";

export type RequireAthleteFromBearerSuccess = {
  athlete: NonNullable<Awaited<ReturnType<typeof getAthleteById>>>;
};

export type RequireAthleteFromBearerFailure = {
  error: string;
  status: 400 | 401 | 403 | 404;
};

type AthleteLookup = {
  getAthleteById: typeof getAthleteById;
  getAthleteByFirebaseId: typeof getAthleteByFirebaseId;
};

const defaultLookups: AthleteLookup = {
  getAthleteById,
  getAthleteByFirebaseId,
};

/**
 * Firebase JWT proves identity; x-athlete-id locates the athlete row.
 */
export async function resolveAthleteForVerifiedUid(
  uid: string,
  athleteIdHeader: string | null | undefined,
  lookups: AthleteLookup = defaultLookups
): Promise<RequireAthleteFromBearerSuccess | RequireAthleteFromBearerFailure> {
  const athleteId = athleteIdHeader?.trim();
  if (!athleteId) {
    return {
      error: "Missing athlete session header" as const,
      status: 400 as const,
    };
  }

  const athlete = await lookups.getAthleteById(athleteId);
  if (!athlete) {
    return { error: "Athlete not found" as const, status: 404 as const };
  }
  if (athlete.firebaseId !== uid) {
    return {
      error: "Athlete session mismatch — sign out and back in" as const,
      status: 403 as const,
    };
  }
  return { athlete };
}

/**
 * Temporary RSVP compatibility for older builds that omit x-athlete-id.
 * Do not use on other athlete-authenticated routes.
 */
export async function resolveAthleteForVerifiedUidAllowingFirebaseFallback(
  uid: string,
  athleteIdHeader: string | null | undefined,
  lookups: AthleteLookup = defaultLookups
): Promise<RequireAthleteFromBearerSuccess | RequireAthleteFromBearerFailure> {
  const strict = await resolveAthleteForVerifiedUid(uid, athleteIdHeader, lookups);
  if (!("error" in strict) || strict.status !== 400) {
    return strict;
  }

  const athlete = await lookups.getAthleteByFirebaseId(uid);
  if (!athlete) {
    return { error: "Athlete not found" as const, status: 404 as const };
  }
  return { athlete };
}

/**
 * Resolve the signed-in athlete: Firebase JWT proves identity; x-athlete-id is PK lookup.
 */
export async function requireAthleteFromBearer(
  request: Request
): Promise<RequireAthleteFromBearerSuccess | RequireAthleteFromBearerFailure> {
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

  return resolveAthleteForVerifiedUid(decoded.uid, athleteId);
}

/** RSVP-only: Bearer required; missing x-athlete-id may resolve by Firebase UID. */
export async function requireAthleteFromBearerForRsvp(
  request: Request
): Promise<RequireAthleteFromBearerSuccess | RequireAthleteFromBearerFailure> {
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

  return resolveAthleteForVerifiedUidAllowingFirebaseFallback(
    decoded.uid,
    request.headers.get(ATHLETE_ID_HEADER)
  );
}
