export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import { createRunClubAnnouncement } from '@/lib/domain-runclub-leader';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runclub/[slug]/leader/announcements
 * POST /api/runclub/[slug]/leader/announcements
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
    console.error('[GET leader announcements] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load announcements' }, { status: 500 });
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
      body?: string;
      visibility?: string;
    };

    if (!body.body?.trim()) {
      return NextResponse.json({ success: false, error: 'body is required' }, { status: 400 });
    }

    const announcement = await createRunClubAnnouncement({
      runClubId: auth.club.id,
      authorId: auth.athlete.id,
      title: body.title,
      body: body.body,
      visibility: body.visibility,
    });

    return NextResponse.json({ success: true, announcement });
  } catch (error: unknown) {
    console.error('[POST leader announcements] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to post announcement' },
      { status: 500 }
    );
  }
}
