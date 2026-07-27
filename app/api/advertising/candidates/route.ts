export const dynamic = "force-dynamic";

import {
  listEligibleAdvertisingCandidates,
} from "@/lib/advertising/candidate-service";
import { NextResponse } from "next/server";

/** GET /api/advertising/candidates — eligible athlete candidates for Brand purchase selection. */
export async function GET() {
  try {
    const candidates = await listEligibleAdvertisingCandidates();
    return NextResponse.json({ success: true, candidates });
  } catch (error) {
    console.error("GET /api/advertising/candidates:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
