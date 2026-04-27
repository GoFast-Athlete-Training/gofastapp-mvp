export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { requireRaceMembership } from "@/lib/race-container-membership";

/** GET — race hub members; lists synced shakeout `city_runs` for this registry. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ raceRegistryId: string }> }
) {
  try {
    const { raceRegistryId } = await params;
    if (!raceRegistryId?.trim()) {
      return NextResponse.json({ error: "raceRegistryId required" }, { status: 400 });
    }

    const auth = await getAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const membership = await requireRaceMembership(auth.athlete.id, race.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const runs = await prisma.city_runs.findMany({
      where: {
        raceRegistryId: race.id,
        shakeoutDedupeKey: { not: null },
      },
      orderBy: { date: "asc" },
      include: {
        city_run_rsvps: true,
        runClub: { select: { id: true, name: true, slug: true } },
      },
    });

    const shakeouts = runs.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date.toISOString(),
      meetUpPoint: r.meetUpPoint,
      meetUpLat: r.meetUpLat,
      meetUpLng: r.meetUpLng,
      totalMiles: r.totalMiles,
      pace: r.pace,
      description: r.description,
      postRunActivity: r.postRunActivity,
      startTimeHour: r.startTimeHour,
      startTimeMinute: r.startTimeMinute,
      startTimePeriod: r.startTimePeriod,
      workflowStatus: r.workflowStatus,
      gorunPath: `/gorun/${r.id}`,
      runClub: r.runClub,
      rsvpCount: r.city_run_rsvps.filter((rv) => rv.status === "going").length,
      myRsvp: r.city_run_rsvps.find((rv) => rv.athleteId === auth.athlete.id) ?? null,
    }));

    return NextResponse.json({ success: true, shakeouts });
  } catch (err) {
    console.error("race-hub shakeouts GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
