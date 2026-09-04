export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAthleteFromBearerForRsvp } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';
import { resolveCityRunIdBySegment } from '@/lib/city-run-resolve-segment';
import { upsertCityRunStampForAthlete } from '@/lib/city-run/city-run-stamp';
import { RSVP_ROLE_GOING, RSVP_ROLE_HOST } from '@/lib/city-run/rsvp-role';

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
        role: true,
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
      role: r.role,
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

    const { status, rsvpPhotoUrls, occurrenceDate, stampMode, sourceWorkoutId } = body;
    if (!status || !['going', 'not-going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be going or not-going' }, { status: 400 });
    }

    const normalizedStampMode =
      stampMode === 'use_city' || stampMode === 'keep_mine' ? stampMode : undefined;
    const normalizedSourceWorkoutId =
      typeof sourceWorkoutId === 'string' && sourceWorkoutId.trim()
        ? sourceWorkoutId.trim()
        : undefined;

    const auth = await requireAthleteFromBearerForRsvp(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const run = await prisma.city_runs.findUnique({
      where: { id: resolvedId },
      include: {
        runClub: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    const normalizedRsvpPhotoUrls = Array.isArray(rsvpPhotoUrls) ? rsvpPhotoUrls : Prisma.JsonNull;
    const parsedOccurrenceDate = occurrenceDate ? new Date(occurrenceDate) : null;

    const existingRsvp = await prisma.city_run_rsvps.findUnique({
      where: { runId_athleteId: { runId: resolvedId, athleteId: athlete.id } },
      select: { role: true },
    });

    const rsvpRole =
      status === 'going'
        ? existingRsvp?.role === RSVP_ROLE_HOST
          ? RSVP_ROLE_HOST
          : RSVP_ROLE_GOING
        : null;

    const rsvp = await prisma.city_run_rsvps.upsert({
      where: { runId_athleteId: { runId: resolvedId, athleteId: athlete.id } },
      update: {
        status,
        role: rsvpRole,
        rsvpPhotoUrls: normalizedRsvpPhotoUrls,
        occurrenceDate: parsedOccurrenceDate,
      },
      create: {
        id: generateId(),
        runId: resolvedId,
        athleteId: athlete.id,
        status,
        role: rsvpRole,
        rsvpPhotoUrls: normalizedRsvpPhotoUrls,
        occurrenceDate: parsedOccurrenceDate,
      },
    });

    let stampResult: Awaited<ReturnType<typeof upsertCityRunStampForAthlete>> | null = null;
    if (status === 'going' && run.runClubId) {
      stampResult = await upsertCityRunStampForAthlete(athlete.id, resolvedId, {
        stampMode: normalizedStampMode,
        sourceWorkoutId: normalizedSourceWorkoutId,
      });
    }

    return NextResponse.json({
      success: true,
      rsvp,
      runClubSlug: run.runClub?.slug ?? null,
      runClubId: run.runClubId,
      stamp: stampResult,
      redirectToClub: Boolean(status === 'going' && run.runClub?.slug),
    });
  } catch (err) {
    console.error('Error RSVPing to CityRun:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
