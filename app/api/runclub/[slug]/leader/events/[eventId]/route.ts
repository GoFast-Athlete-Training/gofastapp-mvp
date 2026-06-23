export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import { deleteRunClubEvent, updateRunClubEvent } from '@/lib/domain-runclub-leader';

/**
 * PATCH /api/runclub/[slug]/leader/events/[eventId]
 * DELETE /api/runclub/[slug]/leader/events/[eventId]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; eventId: string }> }
) {
  try {
    const { slug, eventId } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      description?: string | null;
      eventType?: string;
      startsAt?: string;
      endsAt?: string | null;
      location?: string | null;
      visibility?: string;
    };

    const event = await updateRunClubEvent(eventId, auth.club.id, {
      title: body.title,
      description: body.description,
      eventType: body.eventType,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt === undefined ? undefined : body.endsAt ? new Date(body.endsAt) : null,
      location: body.location,
      visibility: body.visibility,
    });

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      event: {
        ...event,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
      },
    });
  } catch (error: unknown) {
    console.error('[PATCH leader event] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; eventId: string }> }
) {
  try {
    const { slug, eventId } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const deleted = await deleteRunClubEvent(eventId, auth.club.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[DELETE leader event] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete event' }, { status: 500 });
  }
}
