import { adminAuth } from "@/lib/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";

/** Must match Brand/Company proxy headers for Brand Partnership checkout. */
export const BRAND_USER_ID_HEADER = "x-gofast-brand-user-id";
export const BRAND_ID_HEADER = "x-gofast-brand-id";

export async function assertBrandBearerAuth(
  request: NextRequest,
): Promise<NextResponse | null> {
  const brandUserId = request.headers.get(BRAND_USER_ID_HEADER)?.trim();
  const brandId = request.headers.get(BRAND_ID_HEADER)?.trim();
  if (!brandUserId || !brandId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await adminAuth.verifyIdToken(auth.substring(7));
    return null;
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}

export function getForwardedBrandUserId(request: NextRequest): string | null {
  return request.headers.get(BRAND_USER_ID_HEADER)?.trim() || null;
}

export function getForwardedBrandId(request: NextRequest): string | null {
  return request.headers.get(BRAND_ID_HEADER)?.trim() || null;
}
