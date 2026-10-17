import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { buildOperationalSeriesList } from "@/lib/runmanage/series-operational-list";

export const dynamic = "force-dynamic";

/**
 * GET /api/runmanage/run-series/[seriesId]
 * Series row + operational stoplight for create-run seeding.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { seriesId } = await params;

  const series = await prisma.run_series.findUnique({
    where: { id: seriesId },
    include: {
      runClub: {
        select: { id: true, name: true, city: true, state: true },
      },
    },
  });

  if (!series) {
    return NextResponse.json({ success: false, error: "Run series not found" }, { status: 404 });
  }

  const [operational] = await buildOperationalSeriesList({
    runClubId: series.runClubId,
  }).then((rows) => rows.filter((r) => r.seriesId === seriesId));

  return NextResponse.json({
    success: true,
    series,
    operational: operational ?? null,
  });
}
