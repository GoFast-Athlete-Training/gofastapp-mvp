import { NextRequest, NextResponse } from "next/server";

/**
 * Server-to-server auth for training engine CRUD from GoFastCompany.
 * Set GOFAST_TRAINING_ENGINE_SECRET on both apps to the same value.
 * Company sends header: x-gofast-training-engine-secret
 */
export function assertTrainingEngineAuth(
  request: NextRequest
): NextResponse | null {
  const expected = process.env.GOFAST_TRAINING_ENGINE_SECRET?.trim();
  const got = request.headers.get("x-gofast-training-engine-secret")?.trim();

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "GOFAST_TRAINING_ENGINE_SECRET is not configured" },
        { status: 500 }
      );
    }
    return null;
  }

  if (got !== expected) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null;
}
