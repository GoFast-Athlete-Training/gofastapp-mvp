export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from "@/lib/training/training-engine-auth";
import {
  upsertPresetFromProdPush,
  type PresetProdPushBody,
} from "@/lib/training/preset-prodpush-upsert";

/**
 * POST /api/training/plan-preset/prodpush
 * Training Manage save → prod preset mirror (Firebase Bearer + x-gofast-staff-id).
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  let body: PresetProdPushBody & { preset?: Record<string, unknown> };
  try {
    body = (await request.json()) as PresetProdPushBody & { preset?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.plan && body.preset) {
    body.plan = body.preset;
  }

  if (!body.plan) {
    return NextResponse.json({ success: false, error: "plan is required" }, { status: 400 });
  }

  const staffId = getForwardedStaffId(request);
  if (staffId && !body.lastSyncedByStaffId) {
    body.lastSyncedByStaffId = staffId;
  }

  const hasBuild =
    body.buildPreset != null ||
    body.phaseGenerate?.build != null ||
    str(body.plan.buildPresetId);
  if (!hasBuild) {
    return NextResponse.json(
      { success: false, error: "buildPreset or plan.buildPresetId is required for prod mirror" },
      { status: 400 },
    );
  }

  try {
    const result = await upsertPresetFromProdPush(body);
    return NextResponse.json({ success: true, presetId: result.presetId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upsert failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
