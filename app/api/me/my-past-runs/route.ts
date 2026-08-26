export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { isCityRunPast, isCityRunWithinPostRunCheckinWindow } from "@/lib/city-run-clock";

/**
 * GET /api/me/my-past-runs — city runs this athlete RSVP'd "going", past the check-in window,
 * with no check-in yet (Were you there — 24h only after run start + buffer).
 */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;
  const nowMs = Date.now();
  const lookbackStart = new Date(nowMs - 24 * 60 * 60 * 1000);

  try {
    const rsvps = await prisma.city_run_rsvps.findMany({
      where: {
        athleteId: athlete.id,
        status: "going",
        city_runs: {
          cityRunType: { in: ['CLUB', 'INDIVIDUAL', 'RUN_CREW'] },
          date: { gte: lookbackStart },
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
            citySlug: true,
            startTimeHour: true,
            startTimeMinute: true,
            startTimePeriod: true,
            timezone: true,
            runClub: {
              select: {
                id: true,
                slug: true,
                name: true,
                logoUrl: true,
                city: true,
              },
            },
          },
        },
      },
      orderBy: { city_runs: { date: "desc" } },
      take: 20,
    });

    const runs = rsvps
      .filter((r) => {
        const run = r.city_runs;
        const clock = {
          date: run.date,
          startTimeHour: run.startTimeHour,
          startTimeMinute: run.startTimeMinute,
          startTimePeriod: run.startTimePeriod,
          timezone: run.timezone,
        };
        return (
          isCityRunPast(clock, nowMs) &&
          isCityRunWithinPostRunCheckinWindow(clock, nowMs)
        );
      })
      .slice(0, 10)
      .map((r) => ({
        id: r.city_runs.id,
        title: r.city_runs.title,
        date: r.city_runs.date.toISOString(),
        city: r.city_runs.citySlug,
        runClub: r.city_runs.runClub,
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
