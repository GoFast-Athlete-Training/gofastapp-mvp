export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

const METERS_PER_MILE = 1609.34;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const plan = await prisma.training_plans.findUnique({
    where: { id },
    select: { athleteId: true },
  });
  if (!plan) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const [activities, completedDays] = await Promise.all([
    prisma.athlete_activities.findMany({
      where: { athleteId: plan.athleteId },
      orderBy: [{ startTime: "desc" }, { id: "desc" }],
      take: 40,
      select: {
        id: true,
        activityName: true,
        activityType: true,
        startTime: true,
        distance: true,
        duration: true,
      },
    }),
    prisma.planned_workouts.findMany({
      where: { planId: id, athleteId: plan.athleteId, workoutCompleted: true },
      orderBy: { date: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        planDay: true,
        workoutType: true,
        estimatedDistanceInMeters: true,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    activities: activities.map((row) => ({
      id: row.id,
      name: row.activityName || row.activityType || "Activity",
      activityType: row.activityType,
      startTime: row.startTime?.toISOString() ?? null,
      miles:
        row.distance != null && row.distance > 0
          ? Math.round((row.distance / METERS_PER_MILE) * 10) / 10
          : null,
      durationSeconds: row.duration,
    })),
    completedDays: completedDays.map((row) => ({
      id: row.id,
      title: row.title,
      planDay: row.planDay,
      workoutType: row.workoutType,
      miles:
        row.estimatedDistanceInMeters != null && row.estimatedDistanceInMeters > 0
          ? Math.round((row.estimatedDistanceInMeters / METERS_PER_MILE) * 10) / 10
          : null,
    })),
  });
}
