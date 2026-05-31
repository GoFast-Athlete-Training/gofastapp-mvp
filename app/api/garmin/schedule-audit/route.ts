export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { garminCalendarSyncState } from "@/lib/garmin-workouts/garmin-calendar-state";
import { ymdFromDate } from "@/lib/training/plan-utils";

/**
 * GET /api/garmin/schedule-audit
 * Read-only: workouts with Garmin library id but missing calendar schedule id,
 * and duplicate plan-day rows for the same UTC date.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const athleteId = auth.athlete.id;
  const daysParam = request.nextUrl.searchParams.get("days");
  const days = Math.min(Math.max(Number(daysParam) || 14, 1), 90);

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.workouts.findMany({
    where: {
      athleteId,
      date: { gte: start, lte: end },
      OR: [
        { garminWorkoutId: { not: null }, garminScheduleId: null },
        { garminWorkoutId: { not: null } },
      ],
    },
    select: {
      id: true,
      title: true,
      date: true,
      planId: true,
      weekNumber: true,
      garminWorkoutId: true,
      garminScheduleId: true,
      updatedAt: true,
    },
    orderBy: [{ date: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });

  const libraryOnly = rows
    .filter((r) => r.garminWorkoutId != null && r.garminScheduleId == null)
    .map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date ? ymdFromDate(r.date) : null,
      planId: r.planId,
      weekNumber: r.weekNumber,
      garminWorkoutId: r.garminWorkoutId,
      calendarState: garminCalendarSyncState(r),
    }));

  const byDateTitle = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.date) continue;
    const key = `${ymdFromDate(r.date)}|${r.title.trim().toLowerCase()}`;
    const list = byDateTitle.get(key) ?? [];
    list.push(r);
    byDateTitle.set(key, list);
  }

  const duplicateSameDay = [...byDateTitle.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => {
      const [dateYmd] = key.split("|");
      return {
        date: dateYmd,
        title: list[0]?.title ?? "",
        count: list.length,
        workoutIds: list.map((w) => w.id),
        garminWorkoutIds: list.map((w) => w.garminWorkoutId),
        garminScheduleIds: list.map((w) => w.garminScheduleId),
      };
    });

  return NextResponse.json({
    ok: true,
    athleteId,
    windowDays: days,
    libraryOnlyCount: libraryOnly.length,
    libraryOnly,
    duplicateSameDayCount: duplicateSameDay.length,
    duplicateSameDay,
  });
}
