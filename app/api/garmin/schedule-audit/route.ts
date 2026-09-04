export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { ymdFromDate } from "@/lib/training/plan-utils";

/**
 * GET /api/garmin/schedule-audit
 * Read-only: planned rows stamped as pushed and duplicate plan-day rows.
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

  const rows = await prisma.planned_workouts.findMany({
    where: {
      athleteId,
      date: { gte: start, lte: end },
    },
    select: {
      id: true,
      title: true,
      date: true,
      planId: true,
      weekNumber: true,
      workoutPushed: true,
      workoutEditedAfterPush: true,
      updatedAt: true,
    },
    orderBy: [{ date: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });

  const pushed = rows
    .filter((r) => r.workoutPushed)
    .map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date ? ymdFromDate(r.date) : null,
      planId: r.planId,
      weekNumber: r.weekNumber,
      workoutEditedAfterPush: r.workoutEditedAfterPush,
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
        plannedWorkoutIds: list.map((w) => w.id),
        workoutPushed: list.map((w) => w.workoutPushed),
      };
    });

  return NextResponse.json({
    ok: true,
    athleteId,
    windowDays: days,
    pushedCount: pushed.length,
    pushed,
    duplicateSameDayCount: duplicateSameDay.length,
    duplicateSameDay,
  });
}
