import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

/**
 * Server-to-server auth for training engine CRUD from GoFastCompany.
 * Company verifies `company_staff` and forwards `x-gofast-staff-id` + the user's Firebase Bearer token.
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
