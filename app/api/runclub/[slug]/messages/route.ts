export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { getRunClubBySlug, getViewerMembership } from '@/lib/domain-runclub';
import {
  listRunClubMessages,
  postRunClubMessage,
  requireActiveClubMembership,
} from '@/lib/domain-runclub-messages';

/**
 * GET /api/runclub/[slug]/messages
 * Active club members only.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const { slug } = await params;
    const club = await getRunClubBySlug(slug);
    if (!club) {
      return NextResponse.json({ error: 'Run club not found' }, { status: 404 });
    }

    const membership = await requireActiveClubMembership(club.id, athlete.id);
    if (!membership) {
      return NextResponse.json({ error: 'Club membership required' }, { status: 403 });
    }

    const messages = await listRunClubMessages(club.id);
    const viewerMembership = await getViewerMembership(club.id, athlete.id);

    return NextResponse.json({
      success: true,
      messages,
      viewerMembership,
    });
  } catch (err) {
    console.error('GET runclub messages:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/runclub/[slug]/messages
 * Active club members only. Leaders can attach linkedRunId.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const { slug } = await params;
    const club = await getRunClubBySlug(slug);
    if (!club) {
      return NextResponse.json({ error: 'Run club not found' }, { status: 404 });
    }

    const membership = await requireActiveClubMembership(club.id, athlete.id);
    if (!membership) {
      return NextResponse.json({ error: 'Club membership required' }, { status: 403 });
    }

    let body: { content?: string; linkedRunId?: string | null } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const linkedRunId =
      membership.role === 'admin' || membership.role === 'owner'
        ? body.linkedRunId ?? null
        : null;

    const message = await postRunClubMessage({
      runClubId: club.id,
      clubSlug: club.slug,
      clubName: club.name,
      athleteId: athlete.id,
      content: body.content ?? '',
      linkedRunId,
    });

    return NextResponse.json({ success: true, message });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    if (message === 'Content is required' || message === 'Linked run not found for this club') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('POST runclub messages:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
