export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Body = { brandId?: string };

/**
 * POST /api/internal/brands/delete-if-unreferenced
 * Machine lane — remove prod brands snap when nothing references it.
 */
export async function POST(request: NextRequest) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const brandId = body.brandId?.trim();
  if (!brandId) {
    return NextResponse.json({ success: false, error: "brandId is required" }, { status: 400 });
  }

  const existing = await prisma.brands.findUnique({ where: { id: brandId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ success: true, deleted: false });
  }

  const [runClubs, cityRuns, specialEvents, runStores] = await Promise.all([
    prisma.run_clubs.count({ where: { brandId } }),
    prisma.city_runs.count({ where: { runBrandId: brandId } }),
    prisma.special_events.count({ where: { brandId } }),
    prisma.run_stores.count({ where: { brandId } }),
  ]);

  const refs = runClubs + cityRuns + specialEvents + runStores;
  if (refs > 0) {
    return NextResponse.json({
      success: true,
      deleted: false,
      warning: `Prod brand still referenced (${refs} links) — left in place`,
    });
  }

  await prisma.brands.delete({ where: { id: brandId } });
  return NextResponse.json({ success: true, deleted: true });
}
