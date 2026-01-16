export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew } from '@/lib/domain-runcrew';

// PUT /api/runcrew/[id]/members/[membershipId]/role - Update member role
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; membershipId: string }> }
) {
  try {
    const { id, membershipId } = await params;
    if (!id || !membershipId) {
      return NextResponse.json({ error: 'Missing crew id or membership id' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const { role } = body;
    if (!role || !['member', 'manager', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be member, manager, or admin' }, { status: 400 });
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

    // Find the membership to update
    const targetMembership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.id === membershipId
    );
    if (!targetMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    // Prevent demoting yourself from admin (must transfer ownership first)
    if (targetMembership.athleteId === athlete.id && role !== 'admin') {
      return NextResponse.json({ error: 'Cannot demote yourself. Transfer ownership first.' }, { status: 400 });
    }

    // Update the membership role
    const { prisma } = await import('@/lib/prisma');
    const updated = await prisma.run_crew_memberships.update({
      where: { id: membershipId },
      data: { role },
      include: {
        Athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoURL: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, membership: updated });
  } catch (err) {
    console.error('Error updating member role:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/runcrew/[id]/members/[membershipId] - Remove/boot a member (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; membershipId: string }> }
) {
  try {
    const { id, membershipId } = await params;
    if (!id || !membershipId) {
      return NextResponse.json({ error: 'Missing crew id or membership id' }, { status: 400 });
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

    // Find the membership to delete
    const targetMembership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.id === membershipId
    );
    if (!targetMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    // Prevent removing yourself (must transfer ownership or delete crew)
    if (targetMembership.athleteId === athlete.id) {
      return NextResponse.json({ error: 'Cannot remove yourself. Transfer ownership or delete crew instead.' }, { status: 400 });
    }

    // Prevent removing the last admin
    const adminCount = crew.membershipsBox?.memberships?.filter(
      (m: any) => m.role === 'admin'
    ).length || 0;
    if (targetMembership.role === 'admin' && adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last admin. Promote another admin first.' }, { status: 400 });
    }

    // Delete the membership
    const { prisma } = await import('@/lib/prisma');
    await prisma.run_crew_memberships.delete({
      where: { id: membershipId },
    });

    return NextResponse.json({ success: true, message: 'Member removed successfully' });
  } catch (err) {
    console.error('Error removing member:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

