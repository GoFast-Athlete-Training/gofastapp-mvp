import { NextRequest } from "next/server";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { requireRaceMembership } from "@/lib/race-container-membership";
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from "@/lib/training/training-engine-auth";

export type HubReadAccess =
  | { mode: "staff"; staffId: string }
  | { mode: "member"; athleteId: string; membership: NonNullable<Awaited<ReturnType<typeof requireRaceMembership>>> };

export async function assertRaceHubReadAccess(
  request: Request,
  raceRegistryId: string,
): Promise<HubReadAccess | { error: string; status: number }> {
  const staffBlock = await assertStaffBearerAuth(request as NextRequest);
  if (!staffBlock) {
    const staffId = getForwardedStaffId(request as NextRequest);
    if (staffId) {
      return { mode: "staff", staffId };
    }
  }

  const auth = await getAthleteFromBearer(request);
  if ("error" in auth) {
    return { error: auth.error, status: auth.status };
  }

  const membership = await requireRaceMembership(auth.athlete.id, raceRegistryId.trim());
  if (!membership) {
    return { error: "Forbidden", status: 403 };
  }

  return { mode: "member", athleteId: auth.athlete.id, membership };
}
