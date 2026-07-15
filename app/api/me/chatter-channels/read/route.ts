export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  markChatterChannelRead,
  type ChatterChannelType,
} from '@/lib/chatter-channels';

const VALID_TYPES = new Set<ChatterChannelType>(['run_club', 'run_crew', 'race_hub']);

/**
 * POST /api/me/chatter-channels/read
 * Mark a channel as read for unread badge counts.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let body: { channelType?: string; channelId?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const channelType = body.channelType as ChatterChannelType | undefined;
    const channelId = body.channelId?.trim();

    if (!channelType || !VALID_TYPES.has(channelType)) {
      return NextResponse.json({ error: 'Invalid channelType' }, { status: 400 });
    }
    if (!channelId) {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }

    const read = await markChatterChannelRead({
      athleteId: auth.athlete.id,
      channelType,
      channelId,
    });

    return NextResponse.json({ success: true, read });
  } catch (err) {
    console.error('POST chatter channel read:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
