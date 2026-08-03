import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

/**
 * Staff-forwarded auth for training engine and companypush receivers from GoFastCompany.
 * Company verifies `company_staff` and forwards `x-gofast-staff-id` + the user's Firebase Bearer token.
 * See `.cursor/rules/companypush-auth.mdc`.
 */
export const STAFF_ID_HEADER = "x-gofast-staff-id";

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
