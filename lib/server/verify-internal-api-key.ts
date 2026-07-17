import { NextResponse } from "next/server";

/**
 * Service-to-service auth for approved-fields inventory APIs.
 * Advertiser platform and other internal callers send x-gofast-internal-key.
 */
export function verifyInternalApiKey(request: Request): boolean {
  const configured = process.env.GOFAST_INTERNAL_API_KEY?.trim();
  if (!configured) return false;

  const provided =
    request.headers.get("x-gofast-internal-key")?.trim() ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return !!provided && provided === configured;
}

export function unauthorizedInternal(): NextResponse {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}
