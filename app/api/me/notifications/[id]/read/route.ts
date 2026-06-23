export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { markAppNotificationRead } from '@/lib/app-notifications/feed';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';

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
  const ok = await markAppNotificationRead({
    athleteId: auth.athlete.id,
    deliveryId: id,
  });
  if (!ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
