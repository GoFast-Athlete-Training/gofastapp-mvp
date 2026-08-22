export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';
import { mapAthleteRunRoute, normalizeRunRouteInput } from '@/lib/gofast-with-me/athlete-run-routes';

const MAX_CAPTION = 2000;

async function requireOwnedAthlete(request: Request, athleteId: string) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 }) };
  }

  const athlete = await getAthleteById(athleteId);
  if (!athlete) {
    return { error: NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 }) };
  }
  if (athlete.firebaseId !== decodedToken.uid) {
    return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { athlete };
}

function validateRunRoute(routeId: string, caption: string | null) {
  if (!routeId) return 'routeId is required';
  if (caption && caption.length > MAX_CAPTION) return `Caption too long (max ${MAX_CAPTION})`;
  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; runRouteId: string }> }
) {
  try {
    const { id: athleteId, runRouteId } = await params;
    if (!athleteId || !runRouteId) {
      return NextResponse.json({ success: false, error: 'Missing run route id' }, { status: 400 });
    }

    const auth = await requireOwnedAthlete(request, athleteId);
    if ('error' in auth) return auth.error;

    const existing = await prisma.athlete_run_routes.findFirst({
      where: { id: runRouteId, athleteId },
      select: { id: true, routeId: true, isPublished: true, publishedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Run route not found' }, { status: 404 });
    }

    const input = normalizeRunRouteInput({
      ...(await request.json().catch(() => ({}))),
      routeId: existing.routeId,
    });
    const validationError = validateRunRoute(input.routeId, input.caption);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const updated = await prisma.athlete_run_routes.update({
      where: { id: runRouteId },
      data: {
        caption: input.caption,
        sortOrder: input.sortOrder,
        isPublished: input.isPublished,
        publishedAt:
          input.isPublished && !existing.publishedAt
            ? new Date()
            : input.isPublished
              ? existing.publishedAt
              : null,
      },
      include: {
        route: {
          select: {
            id: true,
            name: true,
            stravaUrl: true,
            stravaMapUrl: true,
            mapImageUrl: true,
            distanceMiles: true,
            routeNeighborhood: true,
            citySlug: true,
            createdByAthleteId: true,
            createdBy: {
              select: { firstName: true, gofastHandle: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, runRoute: mapAthleteRunRoute(updated) });
  } catch (e) {
    console.error('athlete/run-routes PUT:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; runRouteId: string }> }
) {
  try {
    const { id: athleteId, runRouteId } = await params;
    if (!athleteId || !runRouteId) {
      return NextResponse.json({ success: false, error: 'Missing run route id' }, { status: 400 });
    }

    const auth = await requireOwnedAthlete(request, athleteId);
    if ('error' in auth) return auth.error;

    await prisma.athlete_run_routes.deleteMany({
      where: { id: runRouteId, athleteId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('athlete/run-routes DELETE:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
