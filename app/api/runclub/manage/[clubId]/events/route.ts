export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRunClubEvent } from '@/lib/domain-runclub-leader';
import {
  assertStaffClubManage,
  resolveClubAuthorAthleteId,
} from '@/lib/run-club-staff-manage-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const auth = await assertStaffClubManage(request, clubId);
    if (auth.error) return auth.error;

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
    console.error('[GET staff manage events]', error);
    return NextResponse.json({ success: false, error: 'Failed to load events' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const auth = await assertStaffClubManage(request, clubId);
    if (auth.error) return auth.error;

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

    const creatorId = await resolveClubAuthorAthleteId(auth.club.id);
    if (!creatorId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No club manager athlete on this club — assign a manager before creating events',
        },
        { status: 409 }
      );
    }

    const event = await createRunClubEvent({
      runClubId: auth.club.id,
      creatorId,
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
    console.error('[POST staff manage events]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create event' },
      { status: 500 }
    );
  }
}
