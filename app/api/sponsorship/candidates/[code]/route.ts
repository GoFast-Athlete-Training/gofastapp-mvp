export const dynamic = "force-dynamic";

import { getEligibleCandidateByCode } from "@/lib/sponsorship/candidate-service";
import { NextRequest, NextResponse } from "next/server";

/** GET /api/sponsorship/candidates/[code] — lookup eligible candidate by stable GFA code */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalized = code?.trim().toUpperCase();
  if (!normalized) {
    return NextResponse.json({ success: false, error: "Missing candidate code" }, { status: 400 });
  }

  const candidate = await getEligibleCandidateByCode(normalized);
  if (!candidate) {
    return NextResponse.json({ success: false, error: "Candidate not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, candidate });
}
