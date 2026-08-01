export const dynamic = "force-dynamic";

import { listEligibleSponsorshipCandidates } from "@/lib/sponsorship/candidate-service";
import { NextResponse } from "next/server";

/** @deprecated Use GET /api/sponsorship/candidates */
export async function GET() {
  const candidates = await listEligibleSponsorshipCandidates();
  return NextResponse.json({ success: true, candidates, deprecated: true });
}
