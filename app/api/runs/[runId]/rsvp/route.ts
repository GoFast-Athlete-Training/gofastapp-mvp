export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { rsvpToRun } from '@/lib/domain-runcrew';
import { prisma } from '@/lib/prisma';
import { resolveCityRunEventId } from '@/lib/cityrun-event-resolver';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/**
 * POST /api/runs/[runId]/rsvp
 * RSVP to a CityRun
 * 
 * Requires authentication - user must sign in to RSVP
 * CityRun is a universal run system (public or private)
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

    const { status, rsvpPhotoUrls } = body;
    if (!status || !['going', 'not-going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be going or not-going' }, { status: 400 });
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

    const firebaseId = decodedToken.uid;

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Event-first RSVP path. Resolve incoming legacy id/slug to canonical event id.
    const eventId = await resolveCityRunEventId(runId);
    let rsvp: any;
    if (eventId) {
      const normalizedRsvpPhotoUrls = Array.isArray(rsvpPhotoUrls) ? rsvpPhotoUrls : Prisma.JsonNull;
      try {
        rsvp = await prisma.city_run_event_rsvps.upsert({
          where: {
            cityRunEventId_athleteId: {
              cityRunEventId: eventId,
              athleteId: athlete.id,
            },
          },
          update: {
            status,
            rsvpPhotoUrls: normalizedRsvpPhotoUrls,
          },
          create: {
            id: generateId(),
            cityRunEventId: eventId,
            athleteId: athlete.id,
            status,
            rsvpPhotoUrls: normalizedRsvpPhotoUrls,
          },
        });
      } catch (err: any) {
        // If new table is not available yet, fallback to legacy RSVP flow.
        const missingTable = err?.code === 'P2021' || (typeof err?.message === 'string' && err.message.includes('city_run_event_rsvps'));
        if (!missingTable) {
          console.error('Prisma error:', err);
          return NextResponse.json({ error: 'DB error' }, { status: 500 });
        }
      }
    }

    if (!rsvp) {
      // Legacy fallback while split rolls out.
      const run = await prisma.city_runs.findUnique({
        where: { id: runId },
      });
      if (!run) {
        return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
      }
      try {
        rsvp = await rsvpToRun({
          runId,
          athleteId: athlete.id,
          status: status as 'going' | 'not-going',
          rsvpPhotoUrls: Array.isArray(rsvpPhotoUrls) ? rsvpPhotoUrls : undefined,
        });
      } catch (err) {
        console.error('Prisma error:', err);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, rsvp });
  } catch (err) {
    console.error('Error RSVPing to CityRun:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

