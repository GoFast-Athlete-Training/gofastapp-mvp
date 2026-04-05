export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';

/** POST /api/athlete/[id]/container/toggle — opt in/out of GoFast Container (owner only). Body: { value?: boolean } */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    if (!athleteId) {
      return NextResponse.json({ success: false, error: 'Missing athlete id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const athlete = await getAthleteById(athleteId);
    if (!athlete) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }
    if (athlete.firebaseId !== decodedToken.uid) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    let body: { value?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      /* empty body ok — toggle */
    }

    const next =
      typeof body.value === 'boolean' ? body.value : !athlete.isGoFastContainer;

    await prisma.athlete.update({
      where: { id: athleteId },
      data: { isGoFastContainer: next, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, isGoFastContainer: next });
  } catch (e) {
    console.error('container/toggle:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
