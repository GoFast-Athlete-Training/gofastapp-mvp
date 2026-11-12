export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

function configId(body: Record<string, unknown>, key: string): string | null {
  const raw = body[key];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function phaseData(body: Record<string, unknown>) {
  return {
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Phase",
    description:
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
    longRunConfigId: configId(body, "longRunConfigId"),
    easyConfigId: configId(body, "easyConfigId"),
    tempoConfigId: configId(body, "tempoConfigId"),
    intervalsConfigId: configId(body, "intervalsConfigId"),
  };
}

/** Staff list of universal phase presets. */
export async function GET(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const rows = await prisma.phase_preset.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      longRunConfigId: true,
      easyConfigId: true,
      tempoConfigId: true,
      intervalsConfigId: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ success: true, phasePresets: rows });
}

/** Upsert by id so Training Manage can mirror a row it already created. */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
  const data = phaseData(body);
  if (!id) {
    try {
      const row = await prisma.phase_preset.create({ data });
      return NextResponse.json({ success: true, phasePreset: row });
    } catch {
      return NextResponse.json(
        { success: false, error: "Could not create phase preset." },
        { status: 400 },
      );
    }
  }

  try {
    const row = await prisma.phase_preset.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    return NextResponse.json({ success: true, phasePreset: row });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not save phase preset. Check the run-type configs." },
      { status: 400 },
    );
  }
}
