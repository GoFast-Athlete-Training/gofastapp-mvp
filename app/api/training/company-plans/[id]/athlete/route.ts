export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  loadCompanyPlanAthlete,
  updateCompanyPlanBaselines,
} from "@/lib/training/company-plan-athlete";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const detail = await loadCompanyPlanAthlete(id);
  if (!detail) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, ...detail });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    fiveKPace?: unknown;
    thresholdPace?: unknown;
    aerobicCeilingBpm?: unknown;
    longRunCapabilityMiles?: unknown;
    longRunCapabilityPace?: unknown;
    longRunCapabilityDate?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const result = await updateCompanyPlanBaselines(id, body);
  if (!result.ok) {
    const status = result.error === "Plan not found" ? 404 : 400;
    return NextResponse.json({ success: false, error: result.error }, { status });
  }
  return NextResponse.json({ success: true, athlete: result.athlete });
}
