export const dynamic = 'force-dynamic';

import { attachRunBrandSnap } from '@/lib/runmanage/run-brand-stamp';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertRunManageAuth } from '@/lib/runmanage/require-run-manage-auth';

function isMissingPostRunActivityColumn(error: any) {
  return (
    error?.code === 'P2022' &&
    typeof error?.message === 'string' &&
    error.message.includes('city_runs.postRunActivity')
  );
}

/**
 * GET /api/runs/manage
 * 
 * List all CityRuns for management (templates + instances)
 * CityRun is a universal run system - this endpoint returns all CityRuns
 * Supports filtering by runType
 * 
 * Query params:
 * - workflowStatus: DEVELOP | PENDING | SUBMITTED | APPROVED
 * - pastOnly: "true" = only runs with startDate before today (for adding photos, etc.)
 * - upcomingOnly: default "true"; "false" = return all runs (no date filter)
 * - runClubId: filter to runs for this run_clubs.id (when set, no default date filter unless pastOnly/upcomingOnly)
 * - runType: track | trail | neighborhood | park
 */
function getStartOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const manageRunSelect = {
  id: true,
  slug: true,
  title: true,
  citySlug: true,
  regionSlug: true,
  dayOfWeek: true,
  date: true,
  runClubId: true,
  runSeriesId: true,
  athleteGeneratedId: true,
  cityRunType: true,
  runBrandId: true,
  runBrandName: true,
  runBrandLogoUrl: true,
  runBrandWebsiteUrl: true,
  runBrandInstagramHandle: true,
  runStoreId: true,
  partnerExtras: true,
  raceRegistryId: true,
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
  workflowStatus: true,
  published: true,
  postRunActivity: true,
  routeNeighborhood: true,
  runType: true,
  plannedWorkoutId: true,
  workoutDescription: true,
  routePhotos: true,
  mapImageUrl: true,
  staffNotes: true,
  createdAt: true,
  updatedAt: true,
  runClub: {
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      city: true,
    },
  },
  _count: {
    select: {
      city_run_rsvps: {
        where: {
          status: 'going',
        },
      },
    },
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await assertRunManageAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const workflowStatus = searchParams.get('workflowStatus');
    const pastOnly = searchParams.get('pastOnly') === 'true';
    const upcomingOnly = searchParams.get('upcomingOnly') !== 'false';
    const runClubIdFilter = searchParams.get('runClubId')?.trim();
    const runTypeFilter = searchParams.get('runType')?.trim().toLowerCase();

    const where: any = {};
    if (workflowStatus && ['DEVELOP', 'PENDING', 'SUBMITTED', 'APPROVED'].includes(workflowStatus)) {
      where.workflowStatus = workflowStatus;
    }
    if (runClubIdFilter) {
      where.runClubId = runClubIdFilter;
    }
    if (runTypeFilter && ['track', 'trail', 'neighborhood', 'park'].includes(runTypeFilter)) {
      where.runType = runTypeFilter;
    }
    const startOfToday = getStartOfTodayUTC();
    if (pastOnly) {
      where.date = { lt: startOfToday };
    } else if (upcomingOnly && !runClubIdFilter) {
      where.date = { gte: startOfToday };
    }

    let runs: any[];
    try {
      runs = await prisma.city_runs.findMany({
        where,
        select: manageRunSelect,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });
    } catch (error: any) {
      if (!isMissingPostRunActivityColumn(error)) throw error;
      console.warn('[GET /api/runs/manage] postRunActivity missing; retrying without it');
      const { postRunActivity: _drop, ...selectWithoutPostRun } = manageRunSelect;
      runs = await prisma.city_runs.findMany({
        where,
        select: selectWithoutPostRun,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });
    }

    // Transform to include rsvpCount
    const runsWithCounts = runs.map((run) =>
      attachRunBrandSnap({
        ...run,
        rsvpCount: run._count.city_run_rsvps,
      }),
    );

    return NextResponse.json({
      success: true,
      runs: runsWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching CityRuns for management:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CityRuns', details: error?.message },
      { status: 500 }
    );
  }
}
