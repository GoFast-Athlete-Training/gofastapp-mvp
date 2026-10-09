export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  createTrainingReflection,
  listTrainingReflectionsForOwner,
  normalizeTrainingReflectionInput,
  updateTrainingReflection,
  validateTrainingReflectionInput,
} from '@/lib/gofast-with-me/training-reflections';

/** GET /api/me/training-reflections — list owner reflections */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const reflections = await listTrainingReflectionsForOwner(auth.athlete.id);
    return NextResponse.json({ reflections });
  } catch (e) {
    console.error('GET /api/me/training-reflections:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** POST /api/me/training-reflections — create { caption?, photoUrl?, activityId?, publish? } */
export async function POST(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const input = normalizeTrainingReflectionInput(await request.json().catch(() => ({})));
    const validationError = validateTrainingReflectionInput(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const reflection = await createTrainingReflection(auth.athlete.id, input);
    return NextResponse.json({ reflection });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    if (message === 'Activity not found' || message.includes('already linked')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('POST /api/me/training-reflections:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** PATCH /api/me/training-reflections — body { id, ...fields } */
export async function PATCH(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const input = normalizeTrainingReflectionInput(body);
    const validationError = validateTrainingReflectionInput(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const reflection = await updateTrainingReflection(auth.athlete.id, id, input);
    return NextResponse.json({ reflection });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    if (message === 'Reflection not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'Activity not found' || message.includes('already linked')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('PATCH /api/me/training-reflections:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
