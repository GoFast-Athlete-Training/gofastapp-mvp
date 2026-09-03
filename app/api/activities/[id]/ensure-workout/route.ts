export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { mapSeedToEnsureWorkout } from '@/lib/training/ensure-activity-workout';
import { seedSpawnedWorkoutFromActivity } from '@/lib/training/seed-spawned-workout-from-activity';

/**
 * POST /api/activities/[id]/ensure-workout
 * Owner-only: attach or create a workouts row for a recorded activity so
 * reflection saves have a workoutId to write to.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const activityId = id?.trim();
  if (!activityId) {
    return NextResponse.json({ success: false, error: 'Missing activity id' }, { status: 400 });
  }

  try {
    const activity = await prisma.athlete_activities.findFirst({
      where: { id: activityId, athleteId: auth.athlete.id },
      select: { id: true },
    });
    if (!activity) {
      return NextResponse.json({ success: false, error: 'Activity not found' }, { status: 404 });
    }

    const seeded = await seedSpawnedWorkoutFromActivity(activity.id);
    const mapped = mapSeedToEnsureWorkout(seeded);
    if (!mapped.ok) {
      return NextResponse.json(
        { success: false, error: mapped.message, reason: mapped.reason },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      workoutId: mapped.workoutId,
      alreadyLinked: mapped.alreadyLinked,
    });
  } catch (err) {
    console.error('POST /api/activities/[id]/ensure-workout:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
