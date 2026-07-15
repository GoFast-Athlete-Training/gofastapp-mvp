export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  listChatterChannelsForAthlete,
  totalChatterUnread,
} from '@/lib/chatter-channels';

/**
 * GET /api/me/chatter-channels
 * Universal Chatter inbox — clubs, crews, race hubs the athlete belongs to.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const channels = await listChatterChannelsForAthlete(auth.athlete.id);
    const totalUnread = channels.reduce((sum, channel) => sum + channel.unreadCount, 0);

    return NextResponse.json({
      success: true,
      channels,
      totalUnread,
    });
  } catch (err) {
    console.error('GET chatter channels:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
