export const dynamic = "force-dynamic";

import { listEligibleSponsorshipCandidates } from "@/lib/sponsorship/candidate-service";
import { NextResponse } from "next/server";

/** GET /api/sponsorship/candidates — public eligible athlete inventory for Brand Partnerships */
export async function GET() {
  try {
    const candidates = await listEligibleSponsorshipCandidates();
    return NextResponse.json({ success: true, candidates });
  } catch (error) {
    console.error("GET /api/sponsorship/candidates:", error);
    return NextResponse.json({ success: false, error: "Failed to load candidates" }, { status: 500 });
  }
}
