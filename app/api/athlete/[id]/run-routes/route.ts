export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';
import {
  listAthleteRunRoutesForOwner,
  mapAthleteRunRoute,
  normalizeRunRouteInput,
} from '@/lib/gofast-with-me/athlete-run-routes';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    if (!athleteId) {
      return NextResponse.json({ success: false, error: 'Missing athlete id' }, { status: 400 });
    }

    const auth = await requireOwnedAthlete(request, athleteId);
    if ('error' in auth) return auth.error;

    const runRoutes = await listAthleteRunRoutesForOwner(athleteId);
    return NextResponse.json({ success: true, runRoutes });
  } catch (e) {
    console.error('athlete/run-routes GET:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    if (!athleteId) {
      return NextResponse.json({ success: false, error: 'Missing athlete id' }, { status: 400 });
    }

    const auth = await requireOwnedAthlete(request, athleteId);
    if ('error' in auth) return auth.error;

    const input = normalizeRunRouteInput(await request.json().catch(() => ({})));
    const validationError = validateRunRoute(input.routeId, input.caption);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const route = await prisma.routes.findUnique({
      where: { id: input.routeId },
      select: { id: true },
    });
    if (!route) {
      return NextResponse.json({ success: false, error: 'Route not found' }, { status: 404 });
    }

    const existing = await prisma.athlete_run_routes.findUnique({
      where: {
        athleteId_routeId: { athleteId, routeId: input.routeId },
      },
      select: { id: true, isPublished: true, publishedAt: true },
    });

    const created = existing
      ? await prisma.athlete_run_routes.update({
          where: { id: existing.id },
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
        })
      : await prisma.athlete_run_routes.create({
          data: {
            athleteId,
            routeId: input.routeId,
            caption: input.caption,
            sortOrder: input.sortOrder,
            isPublished: input.isPublished,
            publishedAt: input.isPublished ? new Date() : null,
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

    return NextResponse.json({ success: true, runRoute: mapAthleteRunRoute(created) });
  } catch (e) {
    console.error('athlete/run-routes POST:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
