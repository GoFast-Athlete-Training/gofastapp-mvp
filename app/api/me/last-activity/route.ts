/**
 * GET /api/me/last-activity — newest real session (not junk Sample Activity when real runs exist).
 */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

const GENERIC_NAME_RE = /^(sample|sample activity)$/i;

function isRealSession(row: {
  distance: number | null;
  duration: number | null;
}): boolean {
  const hasDistance = row.distance != null && row.distance > 0;
  const hasDuration = row.duration != null && row.duration > 0;
  return hasDistance || hasDuration;
}

function isGenericName(name: string | null | undefined): boolean {
  const raw = name?.trim();
  if (!raw) return true;
  return GENERIC_NAME_RE.test(raw);
}

export async function GET(_request: Request) {
  const auth = await requireAthleteFromBearer(_request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const rows = await prisma.athlete_activities.findMany({
      where: {
        athleteId: auth.athlete.id,
        startTime: { not: null },
      },
      orderBy: { startTime: "desc" },
      take: 20,
      select: {
        id: true,
        activityName: true,
        activityType: true,
        startTime: true,
        distance: true,
        duration: true,
        garmin_detail_workout: { select: { id: true } },
      },
    });

    const realSessions = rows.filter(isRealSession);
    const nonGeneric = realSessions.filter((r) => !isGenericName(r.activityName));
    const row = nonGeneric[0] ?? realSessions[0] ?? rows[0] ?? null;

    if (!row) {
      return NextResponse.json({ activity: null });
    }

    const { garmin_detail_workout, ...rest } = row;
    return NextResponse.json({
      activity: {
        ...rest,
        startTime: rest.startTime?.toISOString() ?? null,
        linkedWorkoutId: garmin_detail_workout?.id ?? null,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/me/last-activity:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
