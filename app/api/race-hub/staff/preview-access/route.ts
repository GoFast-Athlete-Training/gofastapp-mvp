export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/** Prod does not treat Company staff as a race-hub preview actor. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { success: false, error: "Staff preview is not resolved on prod" },
    { status: 403 },
  );
}
