import { NextRequest, NextResponse } from "next/server";
import {
  assertStaffBearerAuth,
  STAFF_ID_HEADER,
} from "@/lib/training/training-engine-auth";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

/**
 * Athlete app: Firebase Bearer + x-athlete-id (self only).
 * Company / training engine: x-gofast-staff-id + Bearer + athleteId in body or ?athleteId=.
 */
export async function resolveTrainingSubjectAthleteId(
  request: NextRequest,
  bodyAthleteId?: string | null
): Promise<{ ok: true; athleteId: string } | { ok: false; response: NextResponse }> {
  const staffHeader = request.headers.get(STAFF_ID_HEADER)?.trim();
  if (staffHeader) {
    const staffErr = await assertStaffBearerAuth(request);
    if (staffErr) {
      return { ok: false, response: staffErr };
    }
    const fromBody = bodyAthleteId?.trim();
    const fromQuery = request.nextUrl.searchParams.get("athleteId")?.trim();
    const id = fromBody || fromQuery;
    if (!id) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "athleteId required when using staff training-engine auth" },
          { status: 400 }
        ),
      };
    }
    return { ok: true, athleteId: id };
  }

  const athleteAuth = await requireAthleteFromBearer(request);
  if ("error" in athleteAuth) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: athleteAuth.error },
        { status: athleteAuth.status }
      ),
    };
  }
  return { ok: true, athleteId: athleteAuth.athlete.id };
}
