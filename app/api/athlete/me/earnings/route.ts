export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { fetchAthleteSponsorshipEarningsFromSponsorManage } from "@/lib/advertising/sponsor-manage-client";
import { getAthleteConnectStatus } from "@/lib/sponsorship/athlete-stripe-connect-service";

/** GET /api/athlete/me/earnings — credited sponsorship athlete share (MVP1) */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const connectStatus = await getAthleteConnectStatus(auth.athlete);
  const earnings = await fetchAthleteSponsorshipEarningsFromSponsorManage(
    auth.athlete.id,
    authorization,
  );

  return NextResponse.json({
    success: true,
    connectStatus,
    earnings: earnings ?? {
      source: "sponsorship_destination_charge",
      totalCreditedAthleteShareCents: 0,
      creditedSponsorshipCount: 0,
      payoutReady: connectStatus.ready,
      connectState: connectStatus.state,
      label: connectStatus.label,
      detail: connectStatus.detail,
    },
  });
}
