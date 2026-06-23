export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { leaderAuthFailureResponse, requireRunClubLeader } from '@/lib/run-club-leader-auth';
import { updateRunClubAsLeader } from '@/lib/domain-runclub-leader';

/**
 * PATCH /api/runclub/[slug]/leader/club
 * Update club content fields leaders are allowed to edit.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await requireRunClubLeader(request, { slug });
    if ('error' in auth) {
      return leaderAuthFailureResponse(auth);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const runClub = await updateRunClubAsLeader(auth.club.id, body);

    return NextResponse.json({ success: true, runClub });
  } catch (error: unknown) {
    console.error('[PATCH /api/runclub/[slug]/leader/club] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown';
    const status = message.includes('No allowed fields') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
