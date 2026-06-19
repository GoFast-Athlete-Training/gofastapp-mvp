export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { getRunClubBySlug } from '@/lib/domain-runclub';
import { prisma } from '@/lib/prisma';

const VALID_STATUSES = new Set(['going', 'maybe', 'not-going']);

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/**
 * POST /api/runclub/[slug]/events/[eventId]/rsvp
 *
 * Upsert RSVP for a club event (non-run programming).
 * Body: { status: 'going' | 'maybe' | 'not-going' }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; eventId: string }> }
) {
  try {
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

    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const { slug, eventId } = await params;
    const club = await getRunClubBySlug(slug);
    if (!club) {
      return NextResponse.json({ error: 'Run club not found' }, { status: 404 });
    }

    const event = await prisma.run_club_events.findFirst({
      where: { id: eventId, runClubId: club.id },
      select: { id: true, title: true, visibility: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Club event not found' }, { status: 404 });
    }

    if (event.visibility === 'members') {
      const membership = await prisma.run_club_memberships.findUnique({
        where: {
          runClubId_athleteId: {
            runClubId: club.id,
            athleteId: athlete.id,
          },
        },
      });
      if (!membership || membership.status !== 'active') {
        return NextResponse.json(
          { error: 'Club membership required for this event' },
          { status: 403 }
        );
      }
    }

    let body: { status?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const status = body.status ?? 'going';
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Use going, maybe, or not-going.' },
        { status: 400 }
      );
    }

    const existing = await prisma.run_club_event_rsvps.findUnique({
      where: {
        eventId_athleteId: {
          eventId,
          athleteId: athlete.id,
        },
      },
    });

    const rsvp = existing
      ? await prisma.run_club_event_rsvps.update({
          where: { id: existing.id },
          data: { status },
        })
      : await prisma.run_club_event_rsvps.create({
          data: {
            id: generateId(),
            eventId,
            athleteId: athlete.id,
            status,
          },
        });

    return NextResponse.json({
      success: true,
      rsvp: {
        id: rsvp.id,
        eventId: rsvp.eventId,
        status: rsvp.status,
        createdAt: rsvp.createdAt.toISOString(),
        updatedAt: rsvp.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('[POST /api/runclub/[slug]/events/[eventId]/rsvp] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to RSVP to club event',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
