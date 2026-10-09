export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { deleteTrainingReflection } from '@/lib/gofast-with-me/training-reflections';

/** DELETE /api/me/training-reflections/[id] */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    const ok = await deleteTrainingReflection(auth.athlete.id, id);
    if (!ok) {
      return NextResponse.json({ error: 'Reflection not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/me/training-reflections/[id]:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
