import { prisma } from './prisma';
import { getDayOfWeekFromDate } from '@/lib/utils/dayOfWeek';

export interface GetRunsFilters {
  gofastCity?: string;
  day?: string;
  runClubSlug?: string; // Filter by slug (for URL compatibility)
  runClubId?: string; // Filter by ID (preferred)
}

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
 * Get runs with optional filters
 * Returns public-safe data (excludes sensitive fields)
 */
export async function getRuns(filters: GetRunsFilters = {}) {
  const where: any = {};
  
  // Debug: Log the filters being applied
  console.log('[getRuns] Filters received:', filters, {
    commitSha: RUNTIME_COMMIT_SHA,
    dbHost: getDbHost(),
  });
  
  // City filter
  if (filters.gofastCity) {
    where.gofastCity = filters.gofastCity;
  }
  
  // RunClub filter - support both slug (URL compatibility) and ID (preferred)
  if (filters.runClubId) {
    where.runClubId = filters.runClubId;
  } else if (filters.runClubSlug) {
    // If filtering by slug, need to look up ID first
    const runClub = await prisma.run_clubs.findUnique({
      where: { slug: filters.runClubSlug },
      select: { id: true },
    });
    if (runClub) {
      where.runClubId = runClub.id;
    } else {
      // No matching run club - return empty
      return [];
    }
  }
  
  // Day filter applied client-side from startDate (MVP1: all runs are single events)

  // Public run hydration: only show upcoming runs (startDate >= start of today UTC)
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  where.startDate = { gte: startOfToday };

  // First, get all runs matching filters with RunClub relation (FK)
  // Note: Prisma model `city_runs` maps to table `city_runs` (migrated from run_crew_runs)
  // Use select to only fetch fields that exist (avoiding migration issues)
  let allRuns;
  try {
    allRuns = await prisma.city_runs.findMany({
      where,
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        gofastCity: true,
        dayOfWeek: true,
        instanceType: true,
        startDate: true,
        date: true,
        endDate: true,
        runClubId: true,
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
        routeNeighborhood: true,
        runType: true,
        workoutDescription: true,
        runClub: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
            city: true,
          },
        },
        cityRunSetup: {
          select: {
            id: true,
            dayOfWeek: true,
            name: true,
          },
        },
      },
    });
    
    // Debug logging to help troubleshoot
    console.log(`[getRuns] Found ${allRuns.length} runs with filters:`, JSON.stringify(filters));
    if (allRuns.length > 0) {
      console.log(`[getRuns] Sample run IDs:`, allRuns.slice(0, 3).map(r => r.id));
    } else {
      // If no runs found, check total count in database for debugging
      const totalCount = await prisma.city_runs.count();
      console.log(`[getRuns] No runs found with filters, but total runs in DB: ${totalCount}`);
    }
  } catch (error: any) {
    console.error('[getRuns] Error querying runs:', error);
    console.error('[getRuns] Error details:', error?.message, error?.code);
    if (isMissingCityRunsColumn(error)) {
      await logCityRunsRuntimeDiagnostics('getRuns');
    }
    throw error;
  }
  
  let filteredRuns = allRuns;
  if (filters.day && filters.day !== 'All Days') {
    filteredRuns = allRuns.filter(run => getDayOfWeekFromDate(run.startDate) === filters.day);
  }
  
  // Return runs with RunClub relation (via FK)
  // Filter to only return public-safe fields
  return filteredRuns.map((run) => ({
    id: run.id,
    slug: run.slug ?? null,
    title: run.title,
    gofastCity: run.gofastCity,
    // For series: dayOfWeek from setup is source of truth; fallback to run.dayOfWeek (legacy)
    dayOfWeek: run.cityRunSetup?.dayOfWeek ?? run.dayOfWeek,
    instanceType: run.instanceType ?? 'STANDALONE',
    cityRunSetup: run.cityRunSetup ? { id: run.cityRunSetup.id, dayOfWeek: run.cityRunSetup.dayOfWeek, name: run.cityRunSetup.name } : null,
    startDate: run.startDate,
    date: run.date,
    endDate: run.endDate,
    runClubId: run.runClubId, // ✅ FK field
    runClub: run.runClub || null, // ✅ FK relation
    runClubSlug: run.runClub?.slug || null, // For backward compatibility
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
    workflowStatus: run.workflowStatus,
    // Exclude sensitive fields:
    // runCrewId, athleteGeneratedId, staffGeneratedId
  }));
}

/**
 * Hydrate missing RunClub data (blocking)
 * Fetches from GoFastCompany API and saves to run_clubs table
 * Called when RunClub data is missing to ensure logos/names display immediately
 */
async function hydrateRunClubs(slugs: string[]) {
  const gofastCompanyApiUrl = process.env.GOFAST_COMPANY_API_URL || process.env.NEXT_PUBLIC_GOFAST_COMPANY_API_URL;
  
  if (!gofastCompanyApiUrl) {
    console.warn('GoFastCompany API URL not configured, skipping RunClub hydration');
    return;
  }
  
  for (const slug of slugs) {
    try {
      const response = await fetch(`${gofastCompanyApiUrl}/api/runclub/public/${slug}`);
      if (response.ok) {
        const clubData = await response.json();
        if (clubData.runClub) {
          // IMPORTANT: Prisma generates UUID `id` automatically - we NEVER set it manually
          await prisma.run_clubs.upsert({
            where: { slug },
            create: {
              // id is NOT set - Prisma generates UUID via @default(uuid())
              slug,
              name: clubData.runClub.name,
              logoUrl: clubData.runClub.logoUrl || clubData.runClub.logo || null,
              city: clubData.runClub.city || null,
              updatedAt: new Date(),
            },
            update: {
              name: clubData.runClub.name,
              logoUrl: clubData.runClub.logoUrl || clubData.runClub.logo || null,
              city: clubData.runClub.city || null,
              syncedAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      console.error(`Failed to hydrate RunClub ${slug}:`, error);
    }
  }
}

