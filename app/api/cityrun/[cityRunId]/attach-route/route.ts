import { NextRequest, NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { attachSavedRouteToCityRun } from '@/lib/city-run/attach-route-to-city-run';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cityrun/[cityRunId]/attach-route
 * After meetup is saved, link a durable routes row to this city run.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cityRunId: string }> }
) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { cityRunId } = await params;
    const body = (await request.json()) as {
      routeId?: string;
      neighborhoodAuthority?: 'auto' | 'cityRun' | 'route';
    };
    const routeId = typeof body.routeId === 'string' ? body.routeId.trim() : '';
    if (!routeId) {
      return NextResponse.json({ error: 'routeId is required' }, { status: 400 });
    }

    const authority =
      body.neighborhoodAuthority === 'cityRun' || body.neighborhoodAuthority === 'route'
        ? body.neighborhoodAuthority
        : 'auto';

    const result = await attachSavedRouteToCityRun(
      cityRunId,
      auth.athlete.id,
      routeId,
      authority
    );
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.conflict
            ? {
                conflict: true,
                cityRunNeighborhood: result.cityRunNeighborhood,
                routeNeighborhood: result.routeNeighborhood,
              }
            : {}),
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      routeId: result.routeId,
      routeName: result.routeName,
    });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error('[POST /api/cityrun/attach-route]', error);
    return NextResponse.json(
      { error: 'Failed to attach route', details: e?.message },
      { status: 500 }
    );
  }
}
