export const dynamic = "force-dynamic";

import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import {
  registryMirrorSelect,
  serializeRegistryMirror,
} from "@/lib/races/registry-mirror-select";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/race-registry/[id]/mirror
 * Staff read-back for Race Manage prod sync compare.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const registryId = id?.trim();
  if (!registryId) {
    return NextResponse.json(
      { success: false, error: "registryId required" },
      { status: 400 }
    );
  }

  const row = await prisma.race_registry.findUnique({
    where: { id: registryId },
    select: registryMirrorSelect,
  });
  if (!row) {
    return NextResponse.json(
      { success: false, error: "Registry not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    registryMirror: serializeRegistryMirror(row),
  });
}
