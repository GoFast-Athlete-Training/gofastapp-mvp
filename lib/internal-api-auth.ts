import { NextResponse } from "next/server";

const HEADER = "x-gofast-internal-key";

/**
 * Validates server-to-server calls (Company → Prod, etc.).
 * When GOFAST_INTERNAL_API_KEY is unset, allows in non-production (dev only).
 */
export function verifyInternalApiKey(request: Request): NextResponse | null {
  const expected = process.env.GOFAST_INTERNAL_API_KEY?.trim();
  const provided = request.headers.get(HEADER)?.trim();

  if (expected) {
    if (!provided || provided !== expected) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Internal API key not configured" },
      { status: 503 }
    );
  }

  console.warn("[internal-api] GOFAST_INTERNAL_API_KEY not set — allowing request in dev");
  return null;
}
