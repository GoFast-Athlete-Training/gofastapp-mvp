export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';
import { resolveCityRunIdBySegment } from '@/lib/city-run-resolve-segment';

/**
 * GET /api/runs/[runId]/rsvp
 * Public list of RSVPs for a city run (no auth). Used by marketing site.
 * [runId] can be id or slug. Only returns RSVPs when the run is APPROVED.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const segment = (runId || '').trim();
    if (!segment) {
      return NextResponse.json({ error: 'Missing run id' }, { status: 400 });
    }

    let run = await prisma.city_runs.findUnique({
      where: { id: segment },
      select: { id: true, workflowStatus: true },
    });
    if (!run) {
      run = await prisma.city_runs.findUnique({
        where: { slug: segment },
        select: { id: true, workflowStatus: true },
      });
    }
    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }
    if (run.workflowStatus !== 'APPROVED') {
      return NextResponse.json({ success: true, rsvps: [] });
    }

    const rows = await prisma.city_run_rsvps.findMany({
      where: { runId: run.id },
      select: {
        id: true,
        status: true,
        athleteId: true,
        Athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const rsvps = rows.map((r) => ({
      id: r.id,
      status: r.status,
      athleteId: r.athleteId,
      Athlete: r.Athlete,
    }));

    return NextResponse.json({ success: true, rsvps });
  } catch (err) {
    console.error('Error listing CityRun RSVPs:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/**
 * POST /api/runs/[runId]/rsvp
 * RSVP to a CityRun.
 *
 * Model C: RSVP targets city_runs directly.
 * For recurring runs, pass occurrenceDate in body to scope the RSVP to a specific occurrence.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const segment = ((await params).runId || '').trim();
    if (!segment) {
      return NextResponse.json({ error: 'Missing run id' }, { status: 400 });
    }
    const resolvedId = await resolveCityRunIdBySegment(segment);
    if (!resolvedId) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const { status, rsvpPhotoUrls, occurrenceDate } = body;
    if (!status || !['going', 'not-going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be going or not-going' }, { status: 400 });
    }

    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const run = await prisma.city_runs.findUnique({ where: { id: resolvedId } });
    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    const normalizedRsvpPhotoUrls = Array.isArray(rsvpPhotoUrls) ? rsvpPhotoUrls : Prisma.JsonNull;
    const parsedOccurrenceDate = occurrenceDate ? new Date(occurrenceDate) : null;

    const rsvp = await prisma.city_run_rsvps.upsert({
      where: { runId_athleteId: { runId: resolvedId, athleteId: athlete.id } },
      update: {
        status,
        rsvpPhotoUrls: normalizedRsvpPhotoUrls,
        occurrenceDate: parsedOccurrenceDate,
      },
      create: {
        id: generateId(),
        runId: resolvedId,
        athleteId: athlete.id,
        status,
        rsvpPhotoUrls: normalizedRsvpPhotoUrls,
        occurrenceDate: parsedOccurrenceDate,
      },
    });

    return NextResponse.json({ success: true, rsvp });
  } catch (err) {
    console.error('Error RSVPing to CityRun:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
