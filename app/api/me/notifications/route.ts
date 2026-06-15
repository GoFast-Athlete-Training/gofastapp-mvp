export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';

/** GET /api/me/notifications — recent in-app notifications */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === '1';

  const notifications = await prisma.athlete_notifications.findMany({
    where: {
      athleteId: auth.athlete.id,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return NextResponse.json({ notifications });
}
