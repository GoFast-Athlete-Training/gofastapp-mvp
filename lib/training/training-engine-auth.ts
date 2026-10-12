import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { STAFF_ID_HEADER } from "@/lib/staff-forward-auth";

export { STAFF_ID_HEADER };

/**
 * Staff-forwarded auth: Firebase Bearer + `x-gofast-staff-id` (training manager or staff seat id on the wire).
 * Callers verify the seat server-side before forwarding; prod verifies the token only.
 */

export async function assertStaffBearerAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const staffId = request.headers.get(STAFF_ID_HEADER)?.trim();
  if (!staffId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await adminAuth.verifyIdToken(auth.substring(7));
    return null;
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
}

export function getForwardedStaffId(request: NextRequest): string | null {
  return request.headers.get(STAFF_ID_HEADER)?.trim() || null;
}
