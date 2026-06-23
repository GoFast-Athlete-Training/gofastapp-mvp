export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import { createRunClubEvent } from '@/lib/domain-runclub-leader';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runclub/[slug]/leader/events
 * POST /api/runclub/[slug]/leader/events
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const events = await prisma.run_club_events.findMany({
      where: { runClubId: auth.club.id },
      orderBy: { startsAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      events: events.map((e) => ({
        ...e,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt?.toISOString() ?? null,
      })),
    });
  } catch (error: unknown) {
    console.error('[GET leader events] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load events' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      eventType?: string;
      startsAt?: string;
      endsAt?: string | null;
      location?: string;
      visibility?: string;
    };

    if (!body.title?.trim() || !body.startsAt) {
      return NextResponse.json(
        { success: false, error: 'title and startsAt are required' },
        { status: 400 }
      );
    }

    const event = await createRunClubEvent({
      runClubId: auth.club.id,
      creatorId: auth.athlete.id,
      title: body.title,
      description: body.description,
      eventType: body.eventType,
      startsAt: new Date(body.startsAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      location: body.location,
      visibility: body.visibility,
    });

    return NextResponse.json({
      success: true,
      event: {
        ...event,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
      },
    });
  } catch (error: unknown) {
    console.error('[POST leader events] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create event' },
      { status: 500 }
    );
  }
}
