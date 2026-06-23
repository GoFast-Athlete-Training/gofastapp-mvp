export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import {
  deleteRunClubAnnouncement,
  updateRunClubAnnouncement,
} from '@/lib/domain-runclub-leader';

/**
 * PATCH /api/runclub/[slug]/leader/announcements/[id]
 * DELETE /api/runclub/[slug]/leader/announcements/[id]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string | null;
      body?: string;
      visibility?: string;
    };

    const announcement = await updateRunClubAnnouncement(id, auth.club.id, body);
    if (!announcement) {
      return NextResponse.json({ success: false, error: 'Announcement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, announcement });
  } catch (error: unknown) {
    console.error('[PATCH leader announcement] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update announcement' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const deleted = await deleteRunClubAnnouncement(id, auth.club.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Announcement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[DELETE leader announcement] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete announcement' }, { status: 500 });
  }
}
