export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/runs/[runId]
 * 
 * Authenticated endpoint to get a single run with RunClub/RunCrew hydration
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
        run_crew_run_rsvps: {
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
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
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
    const userRSVP = athlete ? run.run_crew_run_rsvps.find((r: any) => r.athleteId === athlete.id) : null;
    
    // Format response (exclude sensitive fields)
    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        title: run.title,
        citySlug: run.citySlug,
        isRecurring: run.isRecurring,
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
        runClub,
        runCrew,
        rsvps: run.run_crew_run_rsvps.map((rsvp: any) => ({
          id: rsvp.id,
          status: rsvp.status,
          athleteId: rsvp.athleteId,
          Athlete: rsvp.Athlete,
        })),
        currentRSVP: userRSVP?.status || null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch run', details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/runs/[runId]
 * 
 * Authenticated endpoint to delete a run
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
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Delete the run (cascade will delete RSVPs)
    await prisma.city_runs.delete({
      where: { id: runId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Error deleting run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete run', details: error?.message },
      { status: 500 }
    );
  }
}

