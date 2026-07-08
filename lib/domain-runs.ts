import { prisma } from './prisma';
import { isRunStillUpcomingForDiscover } from '@/lib/run-discover-freshness';
import { getDayOfWeekFromDate } from '@/lib/utils/dayOfWeek';
import { sameDayOfWeek } from '@/lib/utils/dayOfWeekConverter';

export interface GetRunsFilters {
  citySlug?: string;
  day?: string;
  runClubSlug?: string; // Filter by slug (for URL compatibility)
  runClubId?: string; // Filter by ID (preferred)
}

type GetRunsMode = 'public' | 'discovery';

const CITY_RUN_DISCOVER_SELECT = {
  id: true,
  slug: true,
  title: true,
  citySlug: true,
  dayOfWeek: true,
  runSeriesId: true,
  date: true,
  runClubId: true,
  cityRunType: true,
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
  runSeries: {
    select: {
      id: true,
      dayOfWeek: true,
      name: true,
    },
  },
} as const;

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
      "SELECT column_name FROM information_schema.columns WHERE table_name='city_runs' AND column_name IN ('postRunActivity','stravaEventUrl','stravaText','webUrl','webText','igPostText','igPostGraphic','routeNeighborhood','runType','workoutDescription') ORDER BY column_name"
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

function mapCityRunForResponse(run: Awaited<ReturnType<typeof queryCityRunsForDiscover>>[number]) {
  return {
    id: run.id,
    slug: run.slug ?? null,
    title: run.title,
    citySlug: run.citySlug,
    dayOfWeek: run.runSeries?.dayOfWeek ?? run.dayOfWeek,
    runSeriesId: run.runSeriesId ?? null,
    runSeries: run.runSeries
      ? { id: run.runSeries.id, dayOfWeek: run.runSeries.dayOfWeek, name: run.runSeries.name }
      : null,
    date: run.date,
    runClubId: run.runClubId,
    cityRunType: run.cityRunType,
    runClub: run.runClub || null,
    runClubSlug: run.runClub?.slug || null,
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
    published: run.published,
  };
}

async function buildCityRunDiscoverWhere(filters: GetRunsFilters) {
  const where: Record<string, unknown> = {};

  if (filters.citySlug) {
    where.citySlug = filters.citySlug;
  }

  if (filters.runClubId) {
    where.runClubId = filters.runClubId;
  } else if (filters.runClubSlug) {
    const runClub = await prisma.run_clubs.findUnique({
      where: { slug: filters.runClubSlug },
      select: { id: true },
    });
    if (runClub) {
      where.runClubId = runClub.id;
    } else {
      return null;
    }
  }

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  where.date = { gte: startOfToday };
  where.cityRunType = 'CLUB';

  return where;
}

async function queryCityRunsForDiscover(filters: GetRunsFilters, mode: GetRunsMode) {
  const logLabel = mode === 'public' ? 'getRuns' : 'getDiscoveryRuns';

  console.log(`[${logLabel}] Filters received:`, filters, {
    commitSha: RUNTIME_COMMIT_SHA,
    dbHost: getDbHost(),
  });

  const where = await buildCityRunDiscoverWhere(filters);
  if (!where) {
    return [];
  }

  if (mode === 'public') {
    where.published = true;
  }

  let allRuns;
  try {
    allRuns = await prisma.city_runs.findMany({
      where,
      orderBy: { date: 'asc' },
      select: CITY_RUN_DISCOVER_SELECT,
    });

    console.log(`[${logLabel}] Found ${allRuns.length} runs with filters:`, JSON.stringify(filters));
    if (allRuns.length === 0) {
      const totalCount = await prisma.city_runs.count();
      console.log(`[${logLabel}] No runs found with filters, but total runs in DB: ${totalCount}`);
    }
  } catch (error: any) {
    console.error(`[${logLabel}] Error querying runs:`, error);
    console.error(`[${logLabel}] Error details:`, error?.message, error?.code);
    if (isMissingCityRunsColumn(error)) {
      await logCityRunsRuntimeDiagnostics(logLabel);
    }
    throw error;
  }

  const now = new Date();
  let filteredRuns = allRuns.filter((run) =>
    isRunStillUpcomingForDiscover(
      {
        date: run.date,
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        timezone: run.timezone,
      },
      now
    )
  );

  if (filters.day && filters.day !== 'All Days') {
    filteredRuns = filteredRuns.filter((run) => {
      const runDay =
        run.runSeriesId != null
          ? (run.runSeries?.dayOfWeek ?? run.dayOfWeek)
          : getDayOfWeekFromDate(run.date);
      return sameDayOfWeek(runDay, filters.day);
    });
  }

  return filteredRuns;
}

/**
 * SEO/public runs — requires published=true.
 * Returns public-safe data (excludes sensitive fields).
 */
export async function getRuns(filters: GetRunsFilters = {}) {
  const filteredRuns = await queryCityRunsForDiscover(filters, 'public');
  return filteredRuns.map(mapCityRunForResponse);
}

/**
 * Authenticated app discovery — Product club runs without SEO publish gating.
 */
export async function getDiscoveryRuns(filters: GetRunsFilters = {}) {
  const filteredRuns = await queryCityRunsForDiscover(filters, 'discovery');
  return filteredRuns.map(mapCityRunForResponse);
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

