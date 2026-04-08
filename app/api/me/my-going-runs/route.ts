export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

/** GET /api/me/my-going-runs — upcoming city runs this athlete RSVP'd "going" */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;
  const now = new Date();

  try {
    const rsvps = await prisma.city_run_rsvps.findMany({
      where: {
        athleteId: athlete.id,
        status: "going",
        city_runs: { date: { gte: now } },
      },
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
      orderBy: { city_runs: { date: "asc" } },
      take: 10,
    });

    const runs = rsvps.map((r) => ({
      id: r.city_runs.id,
      title: r.city_runs.title,
      date: r.city_runs.date.toISOString(),
      city: r.city_runs.gofastCity,
    }));

    return NextResponse.json({ runs });
  } catch (err: unknown) {
    console.error("GET /api/me/my-going-runs:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
