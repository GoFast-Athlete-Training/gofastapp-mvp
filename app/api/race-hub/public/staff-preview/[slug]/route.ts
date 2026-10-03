export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { loadRaceHubStaffSnapshotBySlug } from "@/lib/race-hub/load-staff-hub-snapshot";

/**
 * GET /api/race-hub/public/staff-preview/[slug]
 * Public read-only hub snapshot for racehubstaff content host (no auth).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: raw } = await params;
    const slug = raw?.trim();
    if (!slug) {
      return NextResponse.json({ success: false, error: "slug required" }, { status: 400 });
    }

    const snapshot = await loadRaceHubStaffSnapshotBySlug(slug);
    if (!snapshot) {
      return NextResponse.json({ success: false, error: "Race not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...snapshot });
  } catch (err) {
    console.error("race-hub public staff-preview GET:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
