export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import {
  applyRotation,
  linkRotationToPreset,
  type RotationType,
} from "@/lib/training/rotation-apply";

function parseRotationType(v: unknown): RotationType | null {
  if (v === "LongRun" || v === "Easy" || v === "Tempo" || v === "Intervals") return v;
  return null;
}

export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rotationType = parseRotationType(body.rotationType);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slots = Array.isArray(body.slots) ? body.slots : [];

    if (!rotationType || !name) {
      return NextResponse.json(
        { success: false, error: "rotationType and name are required" },
        { status: 400 }
      );
    }

    const parsedSlots = slots
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const r = row as Record<string, unknown>;
        const cyclePosition =
          typeof r.cyclePosition === "number" ? Math.round(r.cyclePosition) : null;
        const catalogueWorkoutId =
          typeof r.catalogueWorkoutId === "string" ? r.catalogueWorkoutId.trim() : "";
        if (!cyclePosition || !catalogueWorkoutId) return null;
        return { cyclePosition, catalogueWorkoutId };
      })
      .filter(Boolean) as { cyclePosition: number; catalogueWorkoutId: string }[];

    if (parsedSlots.length === 0) {
      return NextResponse.json({ success: false, error: "slots are required" }, { status: 400 });
    }

    const { configId } = await applyRotation({
      rotationType,
      name,
      description: typeof body.description === "string" ? body.description : null,
      configId: typeof body.configId === "string" ? body.configId : null,
      slots: parsedSlots,
    });

    const presetId = typeof body.presetId === "string" ? body.presetId.trim() : "";
    if (presetId) {
      await linkRotationToPreset(presetId, rotationType, configId);
    }

    return NextResponse.json({ success: true, configId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
