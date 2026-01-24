import { prisma } from './prisma';
import { getDayOfWeekFromDate } from '@/lib/utils/dayOfWeek';

export interface GetRunsFilters {
  citySlug?: string;
  day?: string;
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
  
  // First, get all runs matching filters
  const allRuns = await prisma.city_runs.findMany({
    where,
    orderBy: { startDate: 'asc' },
    // Only return public-safe fields
    select: {
      id: true,
      title: true,
      citySlug: true,
      isRecurring: true,
      dayOfWeek: true,
      startDate: true,
      date: true,
      endDate: true,
      runClubSlug: true,
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
      // Exclude sensitive fields:
      // runCrewId, athleteGeneratedId, staffGeneratedId
    },
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
  
  // MVP1: Return runs without RunClub hydration (simpler, no collisions)
  // RunClub/RunCrew info will be shown on run detail page only
  return filteredRuns;
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
          await prisma.run_clubs.upsert({
            where: { slug },
            create: {
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

