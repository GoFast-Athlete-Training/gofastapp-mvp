export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { hydrateCrew } from '@/lib/domain-runcrew';

// POST /api/runcrew/[id]/transfer-ownership - Transfer ownership to another member
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing crew id' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const { newOwnerMembershipId } = body;
    if (!newOwnerMembershipId) {
      return NextResponse.json({ error: 'Missing newOwnerMembershipId' }, { status: 400 });
    }

    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    // Verify user is admin
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
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Find the new owner membership
    const newOwnerMembership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.id === newOwnerMembershipId
    );
    if (!newOwnerMembership) {
      return NextResponse.json({ error: 'New owner membership not found' }, { status: 404 });
    }

    // Cannot transfer to yourself
    if (newOwnerMembership.athleteId === athlete.id) {
      return NextResponse.json({ error: 'Cannot transfer ownership to yourself' }, { status: 400 });
    }

    // Update roles: new owner becomes admin, old admin becomes member
    const { prisma } = await import('@/lib/prisma');
    await prisma.$transaction([
      prisma.run_crew_memberships.update({
        where: { id: newOwnerMembershipId },
        data: { role: 'admin' },
      }),
      prisma.run_crew_memberships.update({
        where: { id: membership.id },
        data: { role: 'member' },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error transferring ownership:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

