import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/runmanage/staff/bootstrap
 * Prod does not resolve Company staff. Run Manage seats live on the satellite.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { success: false, error: "Staff identity is not resolved on prod" },
    { status: 403 },
  );
}
