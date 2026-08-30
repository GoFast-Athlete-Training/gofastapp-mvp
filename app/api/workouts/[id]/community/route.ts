export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  getWorkoutStoryForOwner,
  normalizeWorkoutStoryInput,
  unpublishWorkoutCommunityStory,
  upsertWorkoutCommunityStory,
  validateWorkoutStoryInput,
} from '@/lib/gofast-with-me/workout-stories';

type Ctx = { params: Promise<{ id: string }> };

function requireContainerEnabled(athlete: { isGoFastContainer?: boolean | null }) {
  if (!athlete.isGoFastContainer) {
    return NextResponse.json(
      {
        success: false,
        error: 'GoFast With Me community is not enabled for this athlete',
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * GET /api/workouts/[id]/community — owner load of community story draft/publish state.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const containerError = requireContainerEnabled(auth.athlete);
    if (containerError) return containerError;

    const { id: workoutId } = await ctx.params;
    if (!workoutId) {
      return NextResponse.json({ success: false, error: 'Missing workout id' }, { status: 400 });
    }

    const story = await getWorkoutStoryForOwner(auth.athlete.id, workoutId);
    if (!story) {
      return NextResponse.json({ success: false, error: 'Workout not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, story });
  } catch (e) {
    console.error('workouts/[id]/community GET:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/workouts/[id]/community — save/publish/unpublish community story.
 * Body: { publicTitle?, howFeltRating?, reflection?, workoutPhotoUrl?, publish?: boolean }
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const containerError = requireContainerEnabled(auth.athlete);
    if (containerError) return containerError;

    const { id: workoutId } = await ctx.params;
    if (!workoutId) {
      return NextResponse.json({ success: false, error: 'Missing workout id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const unpublishOnly = body && typeof body === 'object' && (body as Record<string, unknown>).unpublish === true;

    if (unpublishOnly) {
      const ok = await unpublishWorkoutCommunityStory(auth.athlete.id, workoutId);
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Workout not found' }, { status: 404 });
      }
      const story = await getWorkoutStoryForOwner(auth.athlete.id, workoutId);
      return NextResponse.json({ success: true, story });
    }

    const input = normalizeWorkoutStoryInput(body);
    if (input.publish) {
      const validationError = validateWorkoutStoryInput(input);
      if (validationError) {
        return NextResponse.json({ success: false, error: validationError }, { status: 400 });
      }
    }

    const story = await upsertWorkoutCommunityStory(auth.athlete.id, workoutId, input);
    return NextResponse.json({ success: true, story });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    if (message === 'Workout not found') {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    console.error('workouts/[id]/community PATCH:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
