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

    // Verify athlete exists
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const { runId } = await params;

    // Fetch run with RSVPs
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
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Hydrate RunClub if exists
    let runClub = null;
    if (run.runClubSlug) {
      runClub = await prisma.run_clubs.findUnique({
        where: { slug: run.runClubSlug },
        select: {
          slug: true,
          name: true,
          logoUrl: true,
          city: true,
        },
      });

      // If RunClub not found locally, try to fetch from GoFastCompany
      if (!runClub) {
        const gofastCompanyApiUrl = process.env.GOFAST_COMPANY_API_URL || process.env.NEXT_PUBLIC_GOFAST_COMPANY_API_URL;
        if (gofastCompanyApiUrl) {
          try {
            const response = await fetch(`${gofastCompanyApiUrl}/api/runclub/public/${run.runClubSlug}`);
            if (response.ok) {
              const clubData = await response.json();
              if (clubData.runClub) {
                // Save to local DB for next time
                await prisma.run_clubs.upsert({
                  where: { slug: run.runClubSlug },
                  create: {
                    slug: run.runClubSlug,
                    name: clubData.runClub.name,
                    logoUrl: clubData.runClub.logoUrl || clubData.runClub.logo || null,
                    city: clubData.runClub.city || null,
                  },
                  update: {
                    name: clubData.runClub.name,
                    logoUrl: clubData.runClub.logoUrl || clubData.runClub.logo || null,
                    city: clubData.runClub.city || null,
                    syncedAt: new Date(),
                  },
                });
                
                runClub = {
                  slug: run.runClubSlug,
                  name: clubData.runClub.name,
                  logoUrl: clubData.runClub.logoUrl || clubData.runClub.logo || null,
                  city: clubData.runClub.city || null,
                };
              }
            }
          } catch (error) {
            console.error(`Failed to hydrate RunClub ${run.runClubSlug}:`, error);
          }
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
        runClubSlug: run.runClubSlug,
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

