export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRaceHubReadAccess } from "@/lib/race-hub/hub-read-access";
import { serializeHubShakeout } from "@/lib/race-hub-shakeout-utils";

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

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const access = await assertRaceHubReadAccess(request, race.id);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const runs = await prisma.city_runs.findMany({
      where: { raceRegistryId: race.id },
      orderBy: { date: "asc" },
      include: {
        city_run_rsvps: true,
        runClub: { select: { id: true, name: true, slug: true } },
      },
    });

    const athleteIdForRsvp = access.mode === "member" ? access.athleteId : undefined;
    const shakeouts = runs.map((r) => serializeHubShakeout(r, athleteIdForRsvp));

    return NextResponse.json({ success: true, shakeouts });
  } catch (err) {
    console.error("race-hub shakeouts GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
