export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPublicCohortByHandle } from "@/lib/training/cohort-service";

/** GET /api/training-cohorts/public/[handle] — public join surface payload */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;
    const cohort = await getPublicCohortByHandle(handle || "");
    if (!cohort) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, cohort });
  } catch (e) {
    console.error("GET /api/training-cohorts/public/[handle]:", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
