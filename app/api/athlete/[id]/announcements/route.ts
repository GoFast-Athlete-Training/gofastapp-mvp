export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAthleteById } from '@/lib/domain-athlete';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  createAthleteAnnouncement,
  listAthleteAnnouncements,
} from '@/lib/gofast-with-me/athlete-announcements';

type RouteParams = { id: string };

/**
 * GET /api/athlete/[id]/announcements — public list for host community
 * POST /api/athlete/[id]/announcements — host-only create (Run Club pattern)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id: hostAthleteId } = await params;
    const host = await getAthleteById(hostAthleteId);
    if (!host?.isGoFastContainer) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const announcements = await listAthleteAnnouncements(host.id, 20);
    return NextResponse.json({ success: true, announcements });
  } catch (e) {
    console.error('GET /api/athlete/[id]/announcements', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id: hostAthleteId } = await params;
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    if (auth.athlete.id !== hostAthleteId) {
      return NextResponse.json({ success: false, error: 'Only the host can post' }, { status: 403 });
    }

    const host = await getAthleteById(hostAthleteId);
    if (!host?.isGoFastContainer) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      body?: string;
    };
    if (!body.body?.trim()) {
      return NextResponse.json({ success: false, error: 'body is required' }, { status: 400 });
    }

    const announcement = await createAthleteAnnouncement({
      hostAthleteId: host.id,
      authorId: auth.athlete.id,
      title: body.title,
      body: body.body,
    });

    return NextResponse.json({ success: true, announcement });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    console.error('POST /api/athlete/[id]/announcements', e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
