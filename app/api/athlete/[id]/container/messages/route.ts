export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteByFirebaseId, getAthleteById } from '@/lib/domain-athlete';
import { canAccessGoFastContainer } from '@/lib/gofast-container-access';

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
    const take = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30));

    const rows = await prisma.gofast_container_messages.findMany({
      where: { containerAthleteId: host.id },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        authorAthlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoURL: true,
            gofastHandle: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    let list = rows;
    if (rows.length > take) {
      const extra = rows.pop();
      nextCursor = extra?.id ?? null;
      list = rows;
    }

    const messages = list.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      author: {
        id: m.authorAthlete.id,
        firstName: m.authorAthlete.firstName,
        lastName: m.authorAthlete.lastName,
        photoURL: m.authorAthlete.photoURL,
        gofastHandle: m.authorAthlete.gofastHandle,
      },
    }));

    return NextResponse.json({ success: true, messages, nextCursor });
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

    let body: { body?: string } = {};
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

    const created = await prisma.gofast_container_messages.create({
      data: {
        containerAthleteId: host.id,
        authorAthleteId: caller.id,
        body: text,
      },
      include: {
        authorAthlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoURL: true,
            gofastHandle: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: created.id,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
        author: {
          id: created.authorAthlete.id,
          firstName: created.authorAthlete.firstName,
          lastName: created.authorAthlete.lastName,
          photoURL: created.authorAthlete.photoURL,
          gofastHandle: created.authorAthlete.gofastHandle,
        },
      },
    });
  } catch (e) {
    console.error('container/messages POST:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
