export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';

/**
 * Path B — Prod club manager creates a club-hosted race on Race Manage.
 * Proxies to Race Manage POST /api/races/from-club (shared contract; enabled after HQ align).
 *
 * Not the same as POST /leader/events (run_club_events hangouts) or POST /api/race/create (athlete goals).
 */
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

    const base =
      process.env.GOFAST_RACE_MANAGE_URL?.trim() ||
      process.env.NEXT_PUBLIC_GOFAST_RACE_MANAGE_URL?.trim();
    if (!base) {
      return NextResponse.json(
        { success: false, error: 'Race Manage URL not configured', code: 'CLUB_RACE_CREATE_STUB' },
        { status: 503 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const internalKey = process.env.GOFAST_INTERNAL_API_KEY?.trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(internalKey ? { 'x-gofast-internal-key': internalKey } : {}),
      ...(request.headers.get('authorization')
        ? { Authorization: request.headers.get('authorization')! }
        : {}),
    };

    const rmRes = await fetch(`${base.replace(/\/$/, '')}/api/races/from-club`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...body,
        clubId: auth.club.id,
      }),
    });

    const payload = (await rmRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: rmRes.status });
  } catch (error: unknown) {
    console.error('[POST leader races] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create club race' }, { status: 500 });
  }
}
