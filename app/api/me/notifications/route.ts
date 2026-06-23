export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAppNotificationFeed } from '@/lib/app-notifications/feed';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';

/** GET /api/me/notifications — derived in-app feed from template deliveries + source objects */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === '1';

  const notifications = await getAppNotificationFeed({
    athleteId: auth.athlete.id,
    unreadOnly,
  });

  return NextResponse.json({ notifications });
}
