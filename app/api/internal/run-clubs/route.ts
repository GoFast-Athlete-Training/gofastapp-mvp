export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/internal/run-clubs
 * Machine lane — list prod run_clubs for Club Manage sync orchestration.
 */
export async function GET(request: NextRequest) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  const clubs = await prisma.run_clubs.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      _count: { select: { runSeries: true } },
    },
  });

  return NextResponse.json({
    success: true,
    runClubs: clubs.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      state: c.state,
      seriesCount: c._count.runSeries,
    })),
  });
}
