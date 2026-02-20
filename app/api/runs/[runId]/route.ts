export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const RUNTIME_COMMIT_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.RENDER_GIT_COMMIT ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  'unknown';

function getDbHost() {
  const databaseUrl = process.env.DATABASE_URL || '';
  try {
    return new URL(databaseUrl).hostname || 'unknown';
  } catch {
    return 'unparseable';
  }
}

function isMissingCityRunsColumn(error: any) {
  return (
    error?.code === 'P2022' &&
    typeof error?.message === 'string' &&
    error.message.includes('city_runs.')
  );
}

function isMissingRunClubsColumn(error: any) {
  return (
    error?.code === 'P2022' &&
    typeof error?.message === 'string' &&
    error.message.includes('run_clubs.')
  );
}

const UNSUPPORTED_CITY_RUN_FIELDS = [
  'postRunActivity',
  'stravaUrl',
  'stravaText',
  'webUrl',
  'webText',
  'igPostText',
  'igPostGraphic',
] as const;

async function logCityRunsRuntimeDiagnostics(context: string) {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name='city_runs' AND column_name IN ('postRunActivity','stravaUrl','stravaText','webUrl','webText','igPostText','igPostGraphic','routeNeighborhood','runType','workoutDescription') ORDER BY column_name"
    )) as Array<{ column_name: string }>;
    console.error(`[${context}] Runtime diagnostics`, {
      commitSha: RUNTIME_COMMIT_SHA,
      dbHost: getDbHost(),
      cityRunsColumns: rows.map((r) => r.column_name),
    });
  } catch (diagnosticError: any) {
    console.error(`[${context}] Failed runtime diagnostics`, {
      commitSha: RUNTIME_COMMIT_SHA,
      dbHost: getDbHost(),
      diagnosticError: diagnosticError?.message,
    });
  }
}

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
    console.log('[GET /api/runs/[runId]] Runtime info', {
      runId,
      commitSha: RUNTIME_COMMIT_SHA,
      dbHost: getDbHost(),
    });

    // Fetch run with RSVPs and RunClub (FK relation)
    // Use select instead of include to avoid querying non-existent columns in production
    let run: any;
    try {
      run = await prisma.city_runs.findUnique({
        where: { id: runId },
        select: {
          id: true,
          slug: true,
          title: true,
          citySlug: true,
          dayOfWeek: true,
          startDate: true,
          date: true,
          endDate: true,
          runClubId: true,
          runCrewId: true,
          meetUpPoint: true,
          meetUpStreetAddress: true,
          meetUpCity: true,
          meetUpState: true,
          meetUpZip: true,
          meetUpLat: true,
          meetUpLng: true,
          startTimeHour: true,
          startTimeMinute: true,
          startTimePeriod: true,
          timezone: true,
          totalMiles: true,
          pace: true,
          description: true,
          stravaMapUrl: true,
          routePhotos: true,
          mapImageUrl: true,
          staffNotes: true,
          stravaUrl: true,
          stravaText: true,
          webUrl: true,
          webText: true,
          igPostText: true,
          igPostGraphic: true,
          workflowStatus: true,
          postRunActivity: true,
          routeNeighborhood: true,
          runType: true,
          workoutDescription: true,
          city_run_rsvps: {
            select: {
              id: true,
              status: true,
              athleteId: true,
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
              description: true,
              websiteUrl: true,
              instagramUrl: true,
              stravaUrl: true,
            },
          },
        },
      });
    } catch (error: any) {
      if (!isMissingCityRunsColumn(error) && !isMissingRunClubsColumn(error)) throw error;
      console.warn('[GET /api/runs/[runId]] column missing; retrying with legacy field set');
      if (isMissingCityRunsColumn(error)) {
        await logCityRunsRuntimeDiagnostics('GET /api/runs/[runId] initial');
      }
      run = await prisma.city_runs.findUnique({
        where: { id: runId },
        select: {
          id: true,
          slug: true,
          title: true,
          citySlug: true,
          dayOfWeek: true,
          startDate: true,
          date: true,
          endDate: true,
          runClubId: true,
          runCrewId: true,
          meetUpPoint: true,
          meetUpStreetAddress: true,
          meetUpCity: true,
          meetUpState: true,
          meetUpZip: true,
          meetUpLat: true,
          meetUpLng: true,
          startTimeHour: true,
          startTimeMinute: true,
          startTimePeriod: true,
          timezone: true,
          totalMiles: true,
          pace: true,
          description: true,
          stravaMapUrl: true,
          routePhotos: true,
          mapImageUrl: true,
          staffNotes: true,
          workflowStatus: true,
          city_run_rsvps: {
            select: {
              id: true,
              status: true,
              athleteId: true,
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
    }

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
                    description: clubData.runClub.description || null,
                    websiteUrl: clubData.runClub.websiteUrl || clubData.runClub.url || null,
                    instagramUrl: clubData.runClub.instagramUrl || clubData.runClub.instagramHandle || null,
                    stravaUrl: clubData.runClub.stravaUrl || clubData.runClub.stravaClubUrl || null,
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
                    description: true,
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
        routeNeighborhood: run.routeNeighborhood ?? null,
        runType: run.runType ?? null,
        workoutDescription: run.workoutDescription ?? null,
        meetUpLat: run.meetUpLat,
        meetUpLng: run.meetUpLng,
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        timezone: run.timezone,
        totalMiles: run.totalMiles,
        pace: run.pace,
        description: run.description,
        postRunActivity: run.postRunActivity ?? null,
        stravaMapUrl: run.stravaMapUrl,
        routePhotos: run.routePhotos as string[] | null ?? null,
        mapImageUrl: run.mapImageUrl ?? null,
        staffNotes: run.staffNotes ?? null,
        stravaUrl: run.stravaUrl ?? null,
        stravaText: run.stravaText ?? null,
        webUrl: run.webUrl ?? null,
        webText: run.webText ?? null,
        igPostText: run.igPostText ?? null,
        igPostGraphic: run.igPostGraphic ?? null,
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
    if (isMissingCityRunsColumn(error)) {
      await logCityRunsRuntimeDiagnostics('GET /api/runs/[runId] outer');
    }
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
      select: { id: true, runClubId: true },
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
    
    // Source tracking fields
    if (body.stravaUrl !== undefined) {
      updateData.stravaUrl = body.stravaUrl === null || body.stravaUrl === '' ? null : String(body.stravaUrl).trim();
    }
    if (body.stravaText !== undefined) {
      updateData.stravaText = body.stravaText === null || body.stravaText === '' ? null : String(body.stravaText).trim();
    }
    if (body.webUrl !== undefined) {
      updateData.webUrl = body.webUrl === null || body.webUrl === '' ? null : String(body.webUrl).trim();
    }
    if (body.webText !== undefined) {
      updateData.webText = body.webText === null || body.webText === '' ? null : String(body.webText).trim();
    }
    if (body.igPostText !== undefined) {
      updateData.igPostText = body.igPostText === null || body.igPostText === '' ? null : String(body.igPostText).trim();
    }
    if (body.igPostGraphic !== undefined) {
      updateData.igPostGraphic = body.igPostGraphic === null || body.igPostGraphic === '' ? null : String(body.igPostGraphic).trim();
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
    if (body.postRunActivity !== undefined) {
      updateData.postRunActivity = body.postRunActivity === null || body.postRunActivity === '' ? null : String(body.postRunActivity).trim();
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
    if (body.routeNeighborhood !== undefined) {
      updateData.routeNeighborhood = body.routeNeighborhood === null || body.routeNeighborhood === '' ? null : String(body.routeNeighborhood).trim();
    }
    if (body.runType !== undefined) {
      updateData.runType = body.runType === null || body.runType === '' ? null : String(body.runType).trim();
    }
    if (body.workoutDescription !== undefined) {
      updateData.workoutDescription = body.workoutDescription === null || body.workoutDescription === '' ? null : String(body.workoutDescription).trim();
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

    const runClubUpdateData: Record<string, string | null> = {};
    if (body.runClubWebsiteUrl !== undefined) {
      runClubUpdateData.websiteUrl = body.runClubWebsiteUrl === null || body.runClubWebsiteUrl === '' ? null : String(body.runClubWebsiteUrl).trim();
    }
    if (body.runClubInstagramUrl !== undefined) {
      runClubUpdateData.instagramUrl = body.runClubInstagramUrl === null || body.runClubInstagramUrl === '' ? null : String(body.runClubInstagramUrl).trim();
    }
    if (body.runClubStravaUrl !== undefined) {
      runClubUpdateData.stravaUrl = body.runClubStravaUrl === null || body.runClubStravaUrl === '' ? null : String(body.runClubStravaUrl).trim();
    }

    if (Object.keys(updateData).length <= 1) {
      // only updatedAt
      return NextResponse.json({
        success: true,
        run: await prisma.city_runs.findUnique({
          where: { id: runId },
          select: { id: true },
        }),
      });
    }

    let updated;
    try {
      updated = await prisma.city_runs.update({
        where: { id: runId },
        data: updateData as Parameters<typeof prisma.city_runs.update>[0]['data'],
      });
    } catch (error: any) {
      if (!isMissingCityRunsColumn(error)) throw error;
      console.warn('[PUT /api/runs/[runId]] city_runs column missing; retrying with supported fields');
      for (const field of UNSUPPORTED_CITY_RUN_FIELDS) {
        delete updateData[field];
      }
      updated = await prisma.city_runs.update({
        where: { id: runId },
        data: updateData as Parameters<typeof prisma.city_runs.update>[0]['data'],
      });
    }

    if (run.runClubId && Object.keys(runClubUpdateData).length > 0) {
      try {
        await prisma.run_clubs.update({
          where: { id: run.runClubId },
          data: runClubUpdateData,
        });
      } catch (runClubError: any) {
        console.error('[PUT /api/runs/[runId]] Failed updating run club sources:', runClubError?.message || runClubError);
      }
    }

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
      select: { id: true },
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

