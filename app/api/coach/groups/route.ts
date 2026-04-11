export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getCoachByFirebaseId } from '@/lib/domain-coach';
import { prisma } from '@/lib/prisma';

/** GET /api/coach/groups — race_trainer_groups where this coach is COACH */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const coach = await getCoachByFirebaseId(decoded.uid);
    if (!coach) {
      return NextResponse.json({ success: false, error: 'Coach not found' }, { status: 404 });
    }

    const memberships = await prisma.race_trainer_members.findMany({
      where: {
        userId: coach.id,
        role: 'COACH',
      },
      include: {
        race_trainer_groups: {
          include: {
            race_registry: {
              select: {
                id: true,
                name: true,
                raceDate: true,
              },
            },
            _count: {
              select: { race_trainer_members: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const groups = memberships.map((m) => {
      const g = m.race_trainer_groups;
      return {
        membershipId: m.id,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        group: {
          id: g.id,
          name: g.name,
          handle: g.handle,
          description: g.description,
          city: g.city,
          state: g.state,
          isActive: g.isActive,
          memberCount: g._count.race_trainer_members,
          race: g.race_registry
            ? {
                id: g.race_registry.id,
                name: g.race_registry.name,
                raceDate: g.race_registry.raceDate?.toISOString() ?? null,
              }
            : null,
        },
      };
    });

    return NextResponse.json({ success: true, groups });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }
}
