export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { promoteUnmatchedRunningActivityToWorkout } from '@/lib/training/promote-activity-to-workout';
import { mapPromoteToEnsureWorkout } from '@/lib/training/ensure-activity-workout';

/**
 * POST /api/activities/[id]/ensure-workout
 * Owner-only: attach or create a workouts row for a recorded activity so
 * community title / reflection / photo have a workoutId to write to.
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

    const promoted = await promoteUnmatchedRunningActivityToWorkout(activity.id);
    const mapped = mapPromoteToEnsureWorkout(promoted);
    if (!mapped.ok) {
      const status = mapped.reason === 'blocked_by_planned_workout' ? 409 : 422;
      return NextResponse.json(
        { success: false, error: mapped.message, reason: mapped.reason },
        { status }
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
