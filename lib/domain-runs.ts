import { prisma } from './prisma';
import { getDayOfWeekFromDate } from '@/lib/utils/dayOfWeek';

export interface GetRunsFilters {
  citySlug?: string;
  day?: string;
  runClubSlug?: string; // Filter by slug (for URL compatibility)
  runClubId?: string; // Filter by ID (preferred)
}

/**
 * Get runs with optional filters
 * Returns public-safe data (excludes sensitive fields)
 */
export async function getRuns(filters: GetRunsFilters = {}) {
  const where: any = {};
  
  // City filter
  if (filters.citySlug) {
    where.citySlug = filters.citySlug;
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
  
  // Day filter - complex logic for recurring vs single runs
  if (filters.day && filters.day !== 'All Days') {
    // We'll filter by dayOfWeek for recurring runs
    // For single runs, we'll filter client-side or use date comparison
    // For now, include both and filter client-side
    where.OR = [
      // Recurring runs: match dayOfWeek
      { isRecurring: true, dayOfWeek: filters.day },
      // Single runs: will be filtered client-side by date
      { isRecurring: false },
    ];
  }
  
  // First, get all runs matching filters with RunClub relation (FK)
  const allRuns = await prisma.city_runs.findMany({
    where,
    orderBy: { startDate: 'asc' },
    // Use include to get FK relation, then select specific fields
    include: {
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
    // Note: When using include, we get all fields - we'll filter in the return
  });
  
  // Filter single runs by day if day filter is provided
  let filteredRuns = allRuns;
  if (filters.day && filters.day !== 'All Days') {
    filteredRuns = allRuns.filter(run => {
      if (run.isRecurring) {
        // Already filtered by Prisma query
        return run.dayOfWeek === filters.day;
      } else {
        // Single runs: infer day from startDate
        const day = getDayOfWeekFromDate(run.startDate);
        return day === filters.day;
      }
    });
  }
  
  // Return runs with RunClub relation (via FK)
  // Filter to only return public-safe fields
  return filteredRuns.map((run) => ({
    id: run.id,
    title: run.title,
    citySlug: run.citySlug,
    isRecurring: run.isRecurring,
    dayOfWeek: run.dayOfWeek,
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

