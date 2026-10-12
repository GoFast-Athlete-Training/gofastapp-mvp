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
import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";

/**
 * POST /api/training/plan-preset/prodpush
 * Training Manage save → prod preset mirror (Firebase Bearer + x-gofast-staff-id).
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  let body: PresetProdPushBody;
  try {
    body = (await request.json()) as PresetProdPushBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.preset || !body.phaseGenerate) {
    return NextResponse.json(
      { success: false, error: "preset and phaseGenerate are required" },
      { status: 400 },
    );
  }

  const staffId = getForwardedStaffId(request);
  if (staffId && !body.lastSyncedByStaffId) {
    body.lastSyncedByStaffId = staffId;
  }

  const phase = body.phaseGenerate as TrainingManagePresetForGenerate;
  if (!phase.build) {
    return NextResponse.json(
      { success: false, error: "phaseGenerate.build is required for prod mirror" },
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
