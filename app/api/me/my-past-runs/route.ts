export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

/** Same window as CityRunGoingContainer: run.date + 4h before we treat as "past" for check-in / recap. */
function pastRunsCutoff(): Date {
  return new Date(Date.now() - 4 * 60 * 60 * 1000);
}

/**
 * GET /api/me/my-past-runs — city runs this athlete RSVP'd "going" that are past the recap window
 * and have no check-in yet (MVP1 nudge to open post-run UX).
 */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;
  const cutoff = pastRunsCutoff();

  try {
    const rsvps = await prisma.city_run_rsvps.findMany({
      where: {
        athleteId: athlete.id,
        status: "going",
        city_runs: {
          date: { lt: cutoff },
          city_run_checkins: {
            none: { athleteId: athlete.id },
          },
        },
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
      orderBy: { city_runs: { date: "desc" } },
      take: 5,
    });

    const runs = rsvps.map((r) => ({
      id: r.city_runs.id,
      title: r.city_runs.title,
      date: r.city_runs.date.toISOString(),
      city: r.city_runs.gofastCity,
    }));

    return NextResponse.json({ runs });
  } catch (err: unknown) {
    console.error("GET /api/me/my-past-runs:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
