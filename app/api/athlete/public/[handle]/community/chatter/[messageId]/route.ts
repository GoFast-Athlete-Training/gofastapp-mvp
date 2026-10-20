export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  deleteCommunityChatterMessage,
  resolveHostByPublicHandle,
} from '@/lib/gofast-with-me/community-chatter-service';

/** DELETE /api/athlete/public/[handle]/community/chatter/[messageId] — host only */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ handle: string; messageId: string }> }
) {
  try {
    const auth = await requireAthleteFromBearer(_request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { handle: raw, messageId } = await params;
    const host = await resolveHostByPublicHandle(raw);
    if (!host) {
      return NextResponse.json({ success: false, error: 'Community not found' }, { status: 404 });
    }

    try {
      await deleteCommunityChatterMessage(host.id, messageId, auth.athlete.id);
      return NextResponse.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Forbidden';
      const status = msg === 'Not found' ? 404 : msg === 'Forbidden' ? 403 : 400;
      return NextResponse.json({ success: false, error: msg }, { status });
    }
  } catch (e) {
    console.error('DELETE community/chatter:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
