export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { listFollowingForMember } from '@/lib/gofast-with-me/follow-service';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';

/** GET /api/me/following — hosts the signed-in athlete follows (GWM join). */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const following = await listFollowingForMember(auth.athlete.id);
  return NextResponse.json({ success: true, following });
}
