export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';

/** POST /api/me/notifications/[id]/read */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const row = await prisma.athlete_notifications.findFirst({
    where: { id, athleteId: auth.athlete.id },
  });
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.athlete_notifications.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
