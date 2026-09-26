export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRunClubAnnouncement } from '@/lib/domain-runclub-leader';
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

    const announcements = await prisma.run_club_announcements.findMany({
      where: { runClubId: auth.club.id },
      orderBy: { publishedAt: 'desc' },
      include: {
        Athlete: { select: { firstName: true, lastName: true, photoURL: true } },
      },
    });

    return NextResponse.json({
      success: true,
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        visibility: a.visibility,
        publishedAt: a.publishedAt.toISOString(),
        author: a.Athlete,
      })),
    });
  } catch (error: unknown) {
    console.error('[GET staff manage announcements]', error);
    return NextResponse.json({ success: false, error: 'Failed to load announcements' }, { status: 500 });
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
      body?: string;
      visibility?: string;
    };

    if (!body.body?.trim()) {
      return NextResponse.json({ success: false, error: 'body is required' }, { status: 400 });
    }

    const authorId = await resolveClubAuthorAthleteId(auth.club.id);
    if (!authorId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No club manager athlete on this club — assign a manager before posting',
        },
        { status: 409 }
      );
    }

    const announcement = await createRunClubAnnouncement({
      runClubId: auth.club.id,
      authorId,
      title: body.title,
      body: body.body,
      visibility: body.visibility,
    });

    return NextResponse.json({ success: true, announcement });
  } catch (error: unknown) {
    console.error('[POST staff manage announcements]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to post announcement' },
      { status: 500 }
    );
  }
}
