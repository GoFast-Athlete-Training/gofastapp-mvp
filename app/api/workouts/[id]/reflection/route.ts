export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  getWorkoutReflectionForOwner,
  normalizeWorkoutReflectionInput,
  saveWorkoutReflection,
  validateWorkoutReflectionInput,
} from '@/lib/gofast-with-me/workout-stories';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/workouts/[id]/reflection — owner load of personal workout reflection.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id: workoutId } = await ctx.params;
    if (!workoutId) {
      return NextResponse.json({ success: false, error: 'Missing workout id' }, { status: 400 });
    }

    const reflection = await getWorkoutReflectionForOwner(auth.athlete.id, workoutId);
    if (!reflection) {
      return NextResponse.json({ success: false, error: 'Workout not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, reflection });
  } catch (e) {
    console.error('workouts/[id]/reflection GET:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/workouts/[id]/reflection — save personal title, reflection, and photo.
 * Body: { publicTitle?, reflection?, workoutPhotoUrl? }
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id: workoutId } = await ctx.params;
    if (!workoutId) {
      return NextResponse.json({ success: false, error: 'Missing workout id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const input = normalizeWorkoutReflectionInput(body);
    const validationError = validateWorkoutReflectionInput(input);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const reflection = await saveWorkoutReflection(auth.athlete.id, workoutId, input);
    return NextResponse.json({ success: true, reflection });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    if (message === 'Workout not found') {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    console.error('workouts/[id]/reflection PATCH:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
