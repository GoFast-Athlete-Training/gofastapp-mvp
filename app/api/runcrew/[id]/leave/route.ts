export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew } from '@/lib/domain-runcrew';

// POST /api/runcrew/[id]/leave - Leave a crew (member only, not admin)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Get crew and verify membership
    let crew;
    try {
      crew = await hydrateCrew(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this crew' }, { status: 404 });
    }

    // Admins cannot leave - they must transfer ownership or delete the crew
    if (membership.role === 'admin') {
      return NextResponse.json({ 
        error: 'Admins cannot leave. Transfer ownership to another member or delete the crew instead.' 
      }, { status: 400 });
    }

    // Prevent leaving if you're the last member (shouldn't happen, but safety check)
    const memberCount = crew.membershipsBox?.memberships?.length || 0;
    if (memberCount <= 1) {
      return NextResponse.json({ 
        error: 'Cannot leave as the last member. Delete the crew instead.' 
      }, { status: 400 });
    }

    // Delete the membership
    const { prisma } = await import('@/lib/prisma');
    await prisma.run_crew_memberships.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ success: true, message: 'Left crew successfully' });
  } catch (err) {
    console.error('Error leaving crew:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

