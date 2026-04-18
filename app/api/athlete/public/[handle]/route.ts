export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { loadPublicAthletePage } from '@/lib/server/load-public-athlete-page';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/athlete/public/[handle]
 * Public, unauthenticated. Safe fields only. 404 if no athlete with this gofastHandle.
 *
 * The shape mirrors what the RSC page (`/u/[handle]`) consumes via the same loader.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: raw } = await params;
    const payload = await loadPublicAthletePage(raw || '');

    if (!payload) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Container message preview is intentionally only exposed via the API (not the page).
    let containerMessagesPreview: {
      id: string;
      body: string;
      createdAt: string;
      authorDisplay: string;
    }[] = [];

    if (payload.isGoFastContainer && payload.athlete.id) {
      const msgRows = await prisma.gofast_container_messages.findMany({
        where: { containerAthleteId: payload.athlete.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: {
          authorAthlete: {
            select: { firstName: true, lastName: true, gofastHandle: true },
          },
        },
      });
      containerMessagesPreview = msgRows.map((m) => {
        const authorDisplay =
          [m.authorAthlete.firstName, m.authorAthlete.lastName].filter(Boolean).join(' ') ||
          (m.authorAthlete.gofastHandle ? `@${m.authorAthlete.gofastHandle}` : 'Member');
        const raw = m.body;
        const snippet = raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
        return {
          id: m.id,
          body: snippet,
          createdAt: m.createdAt.toISOString(),
          authorDisplay,
        };
      });
    }

    return NextResponse.json({
      success: true,
      ...payload,
      containerMessagesPreview,
    });
  } catch (e: unknown) {
    console.error('GET /api/athlete/public/[handle]:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
