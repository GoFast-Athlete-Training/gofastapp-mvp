export const dynamic = "force-dynamic";

import { resolveAcquisitionInvite } from "@/lib/app-management-api";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ token: string }> };

/**
 * GET /api/acquisition/invite/[token]
 * Public-safe onboarding prefill resolved from App Management invite token.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json({ success: false, error: "token required" }, { status: 400 });
  }

  try {
    const payload = (await resolveAcquisitionInvite(token)) as {
      success?: boolean;
      reason?: string;
      prefill?: Record<string, unknown>;
      invite?: Record<string, unknown>;
    };

    if (!payload.success) {
      return NextResponse.json(
        { success: false, reason: payload.reason ?? "invalid_invite" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      invite: payload.invite,
      prefill: payload.prefill,
    });
  } catch (err) {
    console.error("[acquisition/invite]", err);
    return NextResponse.json({ success: false, error: "Failed to resolve invite" }, { status: 502 });
  }
}
