import { NextResponse } from "next/server";

export const INTERNAL_KEY_HEADER = "x-gofast-internal-key";

export function verifyInternalApiKey(request: Request): NextResponse | null {
  const expected = process.env.GOFAST_INTERNAL_API_KEY?.trim();
  const provided = request.headers.get(INTERNAL_KEY_HEADER)?.trim();

  if (expected) {
    if (!provided || provided !== expected) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "GOFAST_INTERNAL_API_KEY not configured" },
      { status: 503 },
    );
  }

  console.warn("[internal-api] GOFAST_INTERNAL_API_KEY not set — allowing request in dev");
  return null;
}

/** Headers for machine-lane calls to Company (notification triggers, etc.). */
export function internalApiHeaders(extra?: HeadersInit): HeadersInit {
  const key = process.env.GOFAST_INTERNAL_API_KEY?.trim();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(key ? { [INTERNAL_KEY_HEADER]: key } : {}),
    ...extra,
  };
}
