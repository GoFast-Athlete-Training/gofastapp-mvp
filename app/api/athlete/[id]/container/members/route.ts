export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';

/**
 * GET /api/athlete/[id]/container/members
 * Public. [id] = host athlete id. Returns member count + recent members.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hostAthleteId } = await params;
    if (!hostAthleteId) {
      return NextResponse.json({ success: false, error: 'Missing host id' }, { status: 400 });
    }

    const host = await getAthleteById(hostAthleteId);
    if (!host?.isGoFastContainer) {
      return NextResponse.json({
        success: true,
        count: 0,
        members: [],
      });
    }

    const count = await prisma.gofast_container_memberships.count({
      where: { containerAthleteId: host.id },
    });

    const rows = await prisma.gofast_container_memberships.findMany({
      where: { containerAthleteId: host.id },
      orderBy: { joinedAt: 'desc' },
      take: 24,
      include: {
        memberAthlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoURL: true,
            gofastHandle: true,
          },
        },
      },
    });

    const members = rows.map((r) => ({
      id: r.memberAthlete.id,
      firstName: r.memberAthlete.firstName,
      lastName: r.memberAthlete.lastName,
      photoURL: r.memberAthlete.photoURL,
      gofastHandle: r.memberAthlete.gofastHandle,
      joinedAt: r.joinedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, count, members });
  } catch (e) {
    console.error('container/members GET:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
