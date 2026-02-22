export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { prisma } from '@/lib/prisma';

function generateId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/**
 * GET /api/runs/[runId]/messages
 * Returns messages for a CityRun, optionally filtered by topic.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    if (!runId) {
      return NextResponse.json({ error: 'Missing run id' }, { status: 400 });
    }

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

    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic') || undefined;

    const run = await prisma.city_runs.findUnique({ where: { id: runId }, select: { id: true } });
    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    // RSVP = membership. Must be RSVP'd "going" to access participant features.
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }
    const membership = await prisma.city_run_rsvps.findUnique({
      where: { runId_athleteId: { runId, athleteId: athlete.id } },
    });
    if (!membership || membership.status !== 'going') {
      return NextResponse.json({ error: 'RSVP required to view messages' }, { status: 403 });
    }

    const messages = await prisma.city_run_messages.findMany({
      where: { runId, ...(topic ? { topic } : {}) },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, messages });
  } catch (err) {
    console.error('Error fetching city run messages:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/runs/[runId]/messages
 * Post a message to a CityRun. Any authenticated athlete can message.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    if (!runId) {
      return NextResponse.json({ error: 'Missing run id' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

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

    const run = await prisma.city_runs.findUnique({ where: { id: runId }, select: { id: true } });
    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    // RSVP = membership. Must be RSVP'd "going" to post.
    const membership = await prisma.city_run_rsvps.findUnique({
      where: { runId_athleteId: { runId, athleteId: athlete.id } },
    });
    if (!membership || membership.status !== 'going') {
      return NextResponse.json({ error: 'RSVP required to post messages' }, { status: 403 });
    }

    const { content, topic } = body;
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const message = await prisma.city_run_messages.create({
      data: {
        id: generateId(),
        runId,
        athleteId: athlete.id,
        content: content.trim(),
        topic: topic || 'general',
        updatedAt: new Date(),
      },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true },
        },
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error('Error posting city run message:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
