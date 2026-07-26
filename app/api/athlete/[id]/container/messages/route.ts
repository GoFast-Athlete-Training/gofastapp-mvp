export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteByFirebaseId, getAthleteById } from '@/lib/domain-athlete';
import { canAccessGoFastContainer } from '@/lib/gofast-container-access';
import {
  DEFAULT_CONTAINER_TOPIC,
  canMemberPostToTopic,
  isValidContainerTopic,
} from '@/lib/gofast-with-me/container-topics';
import {
  containerMessageInclude,
  mapContainerMessageRow,
} from '@/lib/gofast-with-me/container-message-map';

const MAX_BODY = 2000;

/** GET / POST /api/athlete/[id]/container/messages — [id] = host athlete id */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hostAthleteId } = await params;
    if (!hostAthleteId) {
      return NextResponse.json({ success: false, error: 'Missing host id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const caller = await getAthleteByFirebaseId(decodedToken.uid);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    const host = await getAthleteById(hostAthleteId);
    if (!host?.isGoFastContainer) {
      return NextResponse.json({ success: false, error: 'Not a container' }, { status: 404 });
    }

    const ok = await canAccessGoFastContainer(host.id, caller.id);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const topicParam = searchParams.get('topic')?.trim();
    const topic =
      topicParam && isValidContainerTopic(topicParam) ? topicParam : undefined;
    const take = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30));

    const rows = await prisma.gofast_container_messages.findMany({
      where: {
        containerAthleteId: host.id,
        ...(topic ? { topic } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: containerMessageInclude,
    });

    let nextCursor: string | null = null;
    let list = rows;
    if (rows.length > take) {
      const extra = rows.pop();
      nextCursor = extra?.id ?? null;
      list = rows;
    }

    return NextResponse.json({
      success: true,
      messages: list.map(mapContainerMessageRow),
      nextCursor,
    });
  } catch (e) {
    console.error('container/messages GET:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hostAthleteId } = await params;
    if (!hostAthleteId) {
      return NextResponse.json({ success: false, error: 'Missing host id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const caller = await getAthleteByFirebaseId(decodedToken.uid);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    const host = await getAthleteById(hostAthleteId);
    if (!host?.isGoFastContainer) {
      return NextResponse.json({ success: false, error: 'Not a container' }, { status: 404 });
    }

    const ok = await canAccessGoFastContainer(host.id, caller.id);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    let body: { body?: string; topic?: string; routeId?: string | null; cityRunId?: string | null } =
      {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const text = String(body.body ?? '').trim();
    if (!text) {
      return NextResponse.json({ success: false, error: 'Message body required' }, { status: 400 });
    }
    if (text.length > MAX_BODY) {
      return NextResponse.json(
        { success: false, error: `Message too long (max ${MAX_BODY})` },
        { status: 400 }
      );
    }

    const rawTopic = String(body.topic ?? DEFAULT_CONTAINER_TOPIC).trim();
    const topic = isValidContainerTopic(rawTopic) ? rawTopic : DEFAULT_CONTAINER_TOPIC;
    const isHost = caller.id === host.id;

    if (!isHost && !canMemberPostToTopic(topic)) {
      return NextResponse.json(
        { success: false, error: 'Members can only post in Chatter' },
        { status: 403 }
      );
    }

    let routeId: string | null = null;
    if (topic === 'routes' && body.routeId?.trim()) {
      const route = await prisma.routes.findUnique({
        where: { id: body.routeId.trim() },
        select: { id: true, createdByAthleteId: true },
      });
      if (!route || route.createdByAthleteId !== host.id) {
        return NextResponse.json({ success: false, error: 'Invalid route' }, { status: 400 });
      }
      routeId = route.id;
    }

    let cityRunId: string | null = null;
    if (isHost && body.cityRunId?.trim()) {
      const run = await prisma.city_runs.findFirst({
        where: {
          id: body.cityRunId.trim(),
          athleteGeneratedId: host.id,
          published: true,
        },
        select: { id: true },
      });
      if (!run) {
        return NextResponse.json({ success: false, error: 'Invalid run invite' }, { status: 400 });
      }
      cityRunId = run.id;
    }

    const created = await prisma.gofast_container_messages.create({
      data: {
        containerAthleteId: host.id,
        authorAthleteId: caller.id,
        body: text,
        topic,
        routeId,
        cityRunId,
      },
      include: containerMessageInclude,
    });

    return NextResponse.json({
      success: true,
      message: mapContainerMessageRow(created),
    });
  } catch (e) {
    console.error('container/messages POST:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
