export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runs/[runId]
 * 
 * Authenticated endpoint to get a single CityRun with RunClub/RunCrew hydration
 * 
 * Returns:
 * {
 *   success: true,
 *   run: {...}
 * }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    // Verify authentication
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

    // For GoFastCompany staff, athlete check is optional
    // Staff users from GoFastCompany don't need to be athletes
    const athlete = await getAthleteByFirebaseId(decodedToken.uid).catch(() => null);
    
    // If not an athlete, allow access anyway (likely GoFastCompany staff)
    // This enables GoFastCompany dashboard to view run details

    const { runId } = await params;

    // Fetch run with RSVPs and RunClub (FK relation)
    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
      include: {
        city_run_rsvps: {
          include: {
            Athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoURL: true,
              },
            },
          },
        },
        runClub: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
            city: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    // RunClub is already hydrated via FK relation
    let runClub = run.runClub;
    
    // If RunClub not found locally but runClubId exists, try to fetch from GoFastCompany
    if (!runClub && run.runClubId) {
      const gofastCompanyApiUrl = process.env.GOFAST_COMPANY_API_URL || process.env.NEXT_PUBLIC_GOFAST_COMPANY_API_URL;
      if (gofastCompanyApiUrl) {
        try {
          // Need to get slug from runClubId - query local DB first
          const localRunClub = await prisma.run_clubs.findUnique({
            where: { id: run.runClubId },
            select: { slug: true },
          });
          
          if (localRunClub?.slug) {
            const response = await fetch(`${gofastCompanyApiUrl}/api/runclub/public/${localRunClub.slug}`);
            if (response.ok) {
              const clubData = await response.json();
              if (clubData.runClub) {
                // Save to local DB for next time
                // IMPORTANT: Prisma generates UUID `id` automatically - we NEVER set it manually
                // Use update instead of upsert since we know the ID exists
                await prisma.run_clubs.update({
                  where: { id: run.runClubId },
                  data: {
                    name: clubData.runClub.name,
                    logoUrl: clubData.runClub.logoUrl || clubData.runClub.logo || null,
                    city: clubData.runClub.city || null,
                    syncedAt: new Date(),
                  },
                });
                
                // Re-fetch with updated data
                runClub = await prisma.run_clubs.findUnique({
                  where: { id: run.runClubId },
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                    logoUrl: true,
                    city: true,
                  },
                });
              }
            }
          }
        } catch (error) {
          console.error(`Failed to hydrate RunClub ${run.runClubId}:`, error);
        }
      }
    }

    // Hydrate RunCrew if exists
    let runCrew = null;
    if (run.runCrewId) {
      runCrew = await prisma.run_crews.findUnique({
        where: { id: run.runCrewId },
        select: {
          id: true,
          name: true,
          logo: true,
          handle: true,
        },
      });
    }

    // Get current user's RSVP (if authenticated)
    const userRSVP = athlete ? run.city_run_rsvps.find((r: any) => r.athleteId === athlete.id) : null;
    
    // Format response (exclude sensitive fields)
    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        title: run.title,
        citySlug: run.citySlug,
        dayOfWeek: run.dayOfWeek,
        startDate: run.startDate.toISOString(),
        date: run.date.toISOString(),
        endDate: run.endDate?.toISOString() || null,
        runClubId: run.runClubId,
        runClubSlug: run.runClub?.slug || null, // For backward compatibility
        runCrewId: run.runCrewId,
        meetUpPoint: run.meetUpPoint,
        meetUpStreetAddress: run.meetUpStreetAddress,
        meetUpCity: run.meetUpCity,
        meetUpState: run.meetUpState,
        meetUpZip: run.meetUpZip,
        meetUpLat: run.meetUpLat,
        meetUpLng: run.meetUpLng,
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        timezone: run.timezone,
        totalMiles: run.totalMiles,
        pace: run.pace,
        description: run.description,
        stravaMapUrl: run.stravaMapUrl,
        routePhotos: run.routePhotos as string[] | null ?? null,
        mapImageUrl: run.mapImageUrl ?? null,
        staffNotes: run.staffNotes ?? null,
        runClub,
        runCrew,
        rsvps: run.city_run_rsvps.map((rsvp: any) => ({
          id: rsvp.id,
          status: rsvp.status,
          athleteId: rsvp.athleteId,
          Athlete: rsvp.Athlete,
        })),
        currentRSVP: userRSVP?.status || null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching CityRun:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CityRun', details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/runs/[runId]
 *
 * Authenticated endpoint to update run fields.
 * - Photo/map: routePhotos, mapImageUrl, stravaMapUrl (used by CityRunManager).
 * - Core content: title, totalMiles, pace, description, meetUp*, end*, date/startDate, time, timezone, dayOfWeek (used by Edit Run in GoFastCompany).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { runId } = await params;
    const body = await request.json();

    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Photo/map fields
    if (body.routePhotos !== undefined) {
      updateData.routePhotos = Array.isArray(body.routePhotos)
        ? body.routePhotos.filter((u: unknown) => typeof u === 'string')
        : Prisma.JsonNull;
    }
    if (body.mapImageUrl !== undefined) {
      updateData.mapImageUrl = body.mapImageUrl === null || body.mapImageUrl === ''
        ? null
        : String(body.mapImageUrl);
    }
    if (body.stravaMapUrl !== undefined) {
      updateData.stravaMapUrl = body.stravaMapUrl === null || body.stravaMapUrl === ''
        ? null
        : String(body.stravaMapUrl);
    }
    if (body.staffNotes !== undefined) {
      updateData.staffNotes = body.staffNotes === null || body.staffNotes === ''
        ? null
        : String(body.staffNotes).trim();
    }

    // Core content (edit run)
    if (body.title !== undefined && body.title !== null && String(body.title).trim()) {
      updateData.title = String(body.title).trim();
    }
    if (body.totalMiles !== undefined) {
      updateData.totalMiles = body.totalMiles === null || body.totalMiles === '' ? null : parseFloat(body.totalMiles);
    }
    if (body.pace !== undefined) {
      updateData.pace = body.pace === null || body.pace === '' ? null : String(body.pace);
    }
    if (body.description !== undefined) {
      updateData.description = body.description === null || body.description === '' ? null : String(body.description);
    }
    if (body.meetUpPoint !== undefined && body.meetUpPoint !== null && String(body.meetUpPoint).trim()) {
      updateData.meetUpPoint = String(body.meetUpPoint).trim();
    }
    if (body.meetUpStreetAddress !== undefined) {
      updateData.meetUpStreetAddress = body.meetUpStreetAddress === null || body.meetUpStreetAddress === '' ? null : String(body.meetUpStreetAddress);
    }
    if (body.meetUpCity !== undefined) {
      updateData.meetUpCity = body.meetUpCity === null || body.meetUpCity === '' ? null : String(body.meetUpCity);
    }
    if (body.meetUpState !== undefined) {
      updateData.meetUpState = body.meetUpState === null || body.meetUpState === '' ? null : String(body.meetUpState);
    }
    if (body.meetUpZip !== undefined) {
      updateData.meetUpZip = body.meetUpZip === null || body.meetUpZip === '' ? null : String(body.meetUpZip);
    }
    if (body.meetUpPlaceId !== undefined) {
      updateData.meetUpPlaceId = body.meetUpPlaceId === null || body.meetUpPlaceId === '' ? null : String(body.meetUpPlaceId);
    }
    if (body.meetUpLat !== undefined) {
      updateData.meetUpLat = body.meetUpLat === null || body.meetUpLat === '' ? null : parseFloat(body.meetUpLat);
    }
    if (body.meetUpLng !== undefined) {
      updateData.meetUpLng = body.meetUpLng === null || body.meetUpLng === '' ? null : parseFloat(body.meetUpLng);
    }
    if (body.endPoint !== undefined) {
      updateData.endPoint = body.endPoint === null || body.endPoint === '' ? null : String(body.endPoint);
    }
    if (body.endStreetAddress !== undefined) {
      updateData.endStreetAddress = body.endStreetAddress === null || body.endStreetAddress === '' ? null : String(body.endStreetAddress);
    }
    if (body.endCity !== undefined) {
      updateData.endCity = body.endCity === null || body.endCity === '' ? null : String(body.endCity);
    }
    if (body.endState !== undefined) {
      updateData.endState = body.endState === null || body.endState === '' ? null : String(body.endState);
    }
    if (body.timezone !== undefined) {
      updateData.timezone = body.timezone === null || body.timezone === '' ? null : String(body.timezone);
    }
    if (body.dayOfWeek !== undefined) {
      updateData.dayOfWeek = body.dayOfWeek === null || body.dayOfWeek === '' ? null : String(body.dayOfWeek);
    }
    if (body.startTimeHour !== undefined) {
      updateData.startTimeHour = body.startTimeHour === null || body.startTimeHour === '' ? null : parseInt(body.startTimeHour, 10);
    }
    if (body.startTimeMinute !== undefined) {
      updateData.startTimeMinute = body.startTimeMinute === null || body.startTimeMinute === '' ? null : parseInt(body.startTimeMinute, 10);
    }
    if (body.startTimePeriod !== undefined) {
      updateData.startTimePeriod = body.startTimePeriod === null || body.startTimePeriod === '' ? null : String(body.startTimePeriod);
    }
    if (body.date !== undefined && body.date) {
      const d = new Date(body.date);
      if (!isNaN(d.getTime())) {
        updateData.date = d;
        updateData.startDate = d;
      }
    }

    if (Object.keys(updateData).length <= 1) {
      // only updatedAt
      return NextResponse.json({
        success: true,
        run: await prisma.city_runs.findUnique({ where: { id: runId } }),
      });
    }

    const updated = await prisma.city_runs.update({
      where: { id: runId },
      data: updateData as Parameters<typeof prisma.city_runs.update>[0]['data'],
    });

    return NextResponse.json({
      success: true,
      run: {
        id: updated.id,
        title: updated.title,
        totalMiles: updated.totalMiles,
        pace: updated.pace,
        description: updated.description,
        meetUpPoint: updated.meetUpPoint,
        meetUpStreetAddress: updated.meetUpStreetAddress,
        meetUpCity: updated.meetUpCity,
        meetUpState: updated.meetUpState,
        meetUpZip: updated.meetUpZip,
        routePhotos: updated.routePhotos,
        mapImageUrl: updated.mapImageUrl,
        stravaMapUrl: updated.stravaMapUrl,
        staffNotes: updated.staffNotes,
      },
    });
  } catch (error: any) {
    console.error('Error updating CityRun:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update run', details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/runs/[runId]
 * 
 * Authenticated endpoint to delete a CityRun
 * Cascade deletes all RSVPs associated with the CityRun
 * 
 * Returns:
 * {
 *   success: true
 * }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    // Verify authentication
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

    // For GoFastCompany staff, athlete check is optional
    // Staff users from GoFastCompany don't need to be athletes
    const athlete = await getAthleteByFirebaseId(decodedToken.uid).catch(() => null);
    
    // If not an athlete, allow access anyway (likely GoFastCompany staff)
    // This enables GoFastCompany dashboard to delete runs

    const { runId } = await params;

    // Check if run exists
    const run = await prisma.city_runs.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return NextResponse.json({ error: 'CityRun not found' }, { status: 404 });
    }

    // Delete the run (cascade will delete RSVPs)
    await prisma.city_runs.delete({
      where: { id: runId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Error deleting CityRun:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete CityRun', details: error?.message },
      { status: 500 }
    );
  }
}

