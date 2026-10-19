export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import {
  registryMirrorSelect,
  serializeRegistryMirror,
} from "@/lib/races/registry-mirror-select";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/internal/race-registry/[registryId]/mirror
 * Read-back for Race Manage prod sync compare.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ registryId: string }> }
) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  const { registryId } = await context.params;
  const id = registryId?.trim();
  if (!id) {
    return NextResponse.json({ success: false, error: "registryId required" }, { status: 400 });
  }

  const row = await prisma.race_registry.findUnique({
    where: { id },
    select: registryMirrorSelect,
  });
  if (!row) {
    return NextResponse.json({ success: false, error: "Registry not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    registryMirror: serializeRegistryMirror(row),
  });
}
