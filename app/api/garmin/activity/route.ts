export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAthleteByGarminUserId } from '@/lib/domain-garmin';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const { activityId, userId, activityData } = body;

    let athlete;
    try {
      athlete = await getAthleteByGarminUserId(userId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Create or update activity
    // TODO: Implement full activity creation logic

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
