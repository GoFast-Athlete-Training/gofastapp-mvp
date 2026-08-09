export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAthleteById } from '@/lib/domain-athlete';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { deleteAthleteAnnouncement } from '@/lib/gofast-with-me/athlete-announcements';

type RouteParams = { id: string; announcementId: string };

/** DELETE /api/athlete/[id]/announcements/[announcementId] — host-only */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id: hostAthleteId, announcementId } = await params;
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    if (auth.athlete.id !== hostAthleteId) {
      return NextResponse.json({ success: false, error: 'Only the host can delete' }, { status: 403 });
    }

    const host = await getAthleteById(hostAthleteId);
    if (!host?.isGoFastContainer) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const ok = await deleteAthleteAnnouncement(announcementId, host.id);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/athlete/[id]/announcements/[announcementId]', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
