export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  createAthleteConnectAccountSession,
  getAthleteConnectStatus,
  getOrCreateAthleteConnectAccount,
} from "@/lib/sponsorship/athlete-stripe-connect-service";
import { prisma } from "@/lib/prisma";

/** GET /api/athlete/me/payouts — athlete Connect readiness */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const status = await getAthleteConnectStatus(auth.athlete);
  return NextResponse.json({ success: true, status });
}

/** POST /api/athlete/me/payouts — create Express account + embedded onboarding/management session */
export async function POST(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  let body: { mode?: "onboarding" | "management" } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const { accountId } = await getOrCreateAthleteConnectAccount({ athlete: auth.athlete });
    const mode = body.mode === "management" ? "management" : "onboarding";
    const clientSecret = await createAthleteConnectAccountSession({ accountId, mode });
    const refreshed = await prisma.athlete.findUnique({ where: { id: auth.athlete.id } });
    const status = await getAthleteConnectStatus(refreshed);

    return NextResponse.json({
      success: true,
      clientSecret,
      accountId,
      status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payout session";
    console.error("POST /api/athlete/me/payouts:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
