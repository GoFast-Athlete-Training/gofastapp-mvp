import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";

export const dynamic = "force-dynamic";

/** GET /api/runmanage/run-clubs — clubs that have at least one run_series (for run hub list). */
export async function GET(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const clubs = await prisma.run_clubs.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      citySlug: true,
      state: true,
      _count: { select: { runSeries: true } },
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  const withSeries = clubs.filter((c) => c._count.runSeries > 0);

  return NextResponse.json({
    success: true,
    clubs: withSeries.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      citySlug: c.citySlug,
      state: c.state,
      seriesCount: c._count.runSeries,
    })),
  });
}
