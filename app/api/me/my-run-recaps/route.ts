export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

/** GET /api/me/my-run-recaps — city runs this athlete checked into, newest first */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;

  try {
    const checkins = await prisma.city_run_checkins.findMany({
      where: { athleteId: athlete.id },
      include: {
        city_runs: {
          select: {
            id: true,
            title: true,
            date: true,
            gofastCity: true,
          },
        },
      },
      orderBy: { city_runs: { date: "desc" } },
      take: 10,
    });

    const runs = checkins.map((c) => ({
      id: c.city_runs.id,
      title: c.city_runs.title,
      date: c.city_runs.date.toISOString(),
      city: c.city_runs.gofastCity,
    }));

    return NextResponse.json({ runs });
  } catch (err: unknown) {
    console.error("GET /api/me/my-run-recaps:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
