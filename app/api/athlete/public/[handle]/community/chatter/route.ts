export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  listCommunityChatterMessages,
  postCommunityChatterMessage,
  resolveHostByPublicHandle,
} from '@/lib/gofast-with-me/community-chatter-service';
import { canAccessGfwmHostContent } from '@/lib/gofast-container-access';

/** GET / POST /api/athlete/public/[handle]/community/chatter */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { handle: raw } = await params;
    const host = await resolveHostByPublicHandle(raw);
    if (!host) {
      return NextResponse.json({ success: false, error: 'Community not found' }, { status: 404 });
    }

    const allowed = await canAccessGfwmHostContent(host.id, auth.athlete.id);
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Follow to read Chatter' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '40', 10);

    const { messages, nextCursor } = await listCommunityChatterMessages(host.id, {
      cursor,
      limit,
    });

    return NextResponse.json({ success: true, messages, nextCursor });
  } catch (e) {
    console.error('GET community/chatter:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { handle: raw } = await params;
    const host = await resolveHostByPublicHandle(raw);
    if (!host) {
      return NextResponse.json({ success: false, error: 'Community not found' }, { status: 404 });
    }

    let body: { body?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      const message = await postCommunityChatterMessage(
        host.id,
        auth.athlete.id,
        String(body.body ?? '')
      );
      return NextResponse.json({ success: true, message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Forbidden';
      const status =
        msg === 'Forbidden' ? 403 : msg.includes('required') || msg.includes('long') ? 400 : 400;
      return NextResponse.json({ success: false, error: msg }, { status });
    }
  } catch (e) {
    console.error('POST community/chatter:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
