export const dynamic = "force-dynamic";

import { getEligibleCandidateByCode } from "@/lib/advertising/candidate-service";
import { NextResponse } from "next/server";

/** GET /api/advertising/candidates/[code] — lookup one eligible candidate by purchase code. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ success: false, error: "Missing candidate code" }, { status: 400 });
  }

  try {
    const candidate = await getEligibleCandidateByCode(code);
    if (!candidate) {
      return NextResponse.json({ success: false, error: "Candidate not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, candidate });
  } catch (error) {
    console.error("GET /api/advertising/candidates/[code]:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
