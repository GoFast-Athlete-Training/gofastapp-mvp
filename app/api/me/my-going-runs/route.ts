export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { isCityRunPast } from "@/lib/city-run-clock";

/** GET /api/me/my-going-runs — upcoming city runs this athlete RSVP'd "going" */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;
  const nowMs = Date.now();

  try {
    const rsvps = await prisma.city_run_rsvps.findMany({
      where: {
        athleteId: athlete.id,
        status: "going",
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
            runClubId: true,
            runClub: {
              select: { slug: true, name: true, logoUrl: true },
            },
            plannedWorkoutId: true,
            plannedWorkout: {
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: { city_runs: { date: "asc" } },
      take: 20,
    });

    const runs = rsvps
      .filter((r) => {
        const run = r.city_runs;
        return !isCityRunPast(
          {
            date: run.date,
            startTimeHour: run.startTimeHour,
            startTimeMinute: run.startTimeMinute,
            startTimePeriod: run.startTimePeriod,
            timezone: run.timezone,
          },
          nowMs
        );
      })
      .slice(0, 10)
      .map((r) => ({
        id: r.city_runs.id,
        title: r.city_runs.title,
        date: r.city_runs.date.toISOString(),
        city: r.city_runs.citySlug,
        startTimeHour: r.city_runs.startTimeHour,
        startTimeMinute: r.city_runs.startTimeMinute,
        startTimePeriod: r.city_runs.startTimePeriod,
        timezone: r.city_runs.timezone,
        runClubId: r.city_runs.runClubId,
        runClub: r.city_runs.runClub,
        attachedWorkout: r.city_runs.plannedWorkout
          ? {
              id: r.city_runs.plannedWorkout.id,
              title: r.city_runs.plannedWorkout.title,
            }
          : null,
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
