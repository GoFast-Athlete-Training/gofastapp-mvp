export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

type Params = { params: Promise<{ id: string }> };

const include = {
  longRunConfig: { select: { id: true, name: true } },
  easyConfig: { select: { id: true, name: true } },
  tempoConfig: { select: { id: true, name: true } },
  intervalsConfig: { select: { id: true, name: true } },
} as const;

function configId(body: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in body)) return undefined;
  const raw = body[key];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;
  const { id } = await params;
  const row = await prisma.phase_preset.findUnique({ where: { id }, include });
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, phasePreset: row });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("description" in body) {
    data.description =
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }
  for (const key of ["longRunConfigId", "easyConfigId", "tempoConfigId", "intervalsConfigId"] as const) {
    const value = configId(body, key);
    if (value !== undefined) data[key] = value;
  }
  try {
    const row = await prisma.phase_preset.update({ where: { id }, data, include });
    return NextResponse.json({ success: true, phasePreset: row });
  } catch {
    return NextResponse.json({ success: false, error: "Phase preset not found" }, { status: 404 });
  }
}
