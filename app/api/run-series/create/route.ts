import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCanonicalDayOfWeek } from '@/lib/utils/dayOfWeekConverter';

export const dynamic = 'force-dynamic';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/run-series/create
 *
 * Create or find an existing city_run_setups for a (runClubId + dayOfWeek) pair.
 * Returns the setup + a seeded city_run stub (workflowStatus: DEVELOP).
 *
 * Called from GoFastCompany SeriesSetupWizard ("Set Up This Series").
 *
 * Body:
 *   runClub             object  (optional) — source of truth from GoFastCompany acq_run_clubs; upserted to run_clubs then used for runClubId
 *   runClubId           string  (required if no runClub)
 *   runClubSlug         string  (optional) — preferred lookup when runClub not provided
 *   name                string  (optional) — series label e.g. "Tuesday Tempo"
 *   description         string  (optional) — series blurb; seeds first run description
 *   gofastCity          string  (optional) — city slug
 *   meetUpPoint         string  (optional)
 *   meetUpStreetAddress string  (optional)
 *   meetUpCity          string  (optional)
 *   meetUpState         string  (optional)
 *   meetUpPlaceId       string  (optional)
 *   meetUpLat           number  (optional)
 *   meetUpLng           number  (optional)
 *   startTimeHour       number  (optional)
 *   startTimeMinute     number  (optional)
 *   startTimePeriod     string  (optional) — "AM" | "PM"
 *   seriesStartDate     string  (optional) — ISO date when series began
 *   seriesEndDate       string  (optional) — ISO date when series ends
 *   staffGeneratedId    string  (optional when createFirstRun=false) — creating staff member (required when creating first run)
 *   firstRunDate        string  (optional) — ISO date for the first city_run stub; only used when createFirstRun=true
 *   createFirstRun      boolean (optional, default true) — if false, only create/update run_series; do not create first city_run (MVP1: series-only, no dual mutation)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      runClub: runClubPayload, // Source of truth from Company acq_run_clubs; upsert to run_clubs
      runClubId,
      runClubSlug,
      dayOfWeek,
      name,
      description,
      gofastCity,
      meetUpPoint,
      meetUpStreetAddress,
      meetUpCity,
      meetUpState,
      meetUpPlaceId,
      meetUpLat,
      meetUpLng,
      startTimeHour,
      startTimeMinute,
      startTimePeriod,
      seriesStartDate,
      seriesEndDate,
      staffGeneratedId,
      firstRunDate,
      createFirstRun = true,
    } = body;

    if (!runClubPayload && !runClubSlug?.trim() && !runClubId?.trim()) {
      return NextResponse.json({ success: false, error: 'runClub (source of truth), runClubSlug, or runClubId is required' }, { status: 400 });
    }
    if (!dayOfWeek?.trim()) {
      return NextResponse.json({ success: false, error: 'dayOfWeek is required' }, { status: 400 });
    }
    const createRun = createFirstRun !== false;
    if (createRun && !staffGeneratedId?.trim()) {
      return NextResponse.json({ success: false, error: 'staffGeneratedId is required when creating first run' }, { status: 400 });
    }

    const canonicalDay = toCanonicalDayOfWeek(dayOfWeek) ?? dayOfWeek.trim().toUpperCase();

    // If Company sent runClub (acq_run_clubs source of truth), upsert run_clubs so runClubId is consistent downstream
    let runClub: { id: string; name: string; slug: string | null; city: string | null; allRunsDescription: string | null } | null = null;

    if (runClubPayload && typeof runClubPayload === 'object') {
      const rc = runClubPayload as Record<string, unknown>;
      const id = rc.id != null ? String(rc.id).trim() : null;
      const nameVal = rc.name != null ? String(rc.name).trim() : 'Unnamed';
      const slugVal = rc.slug != null ? String(rc.slug).trim() : (id || nameVal.toLowerCase().replace(/\s+/g, '-'));
      const slugFinal = slugVal || id || `club-${Date.now()}`;
      const updateData = {
        name: nameVal,
        slug: slugFinal,
        city: rc.city != null ? String(rc.city).trim() || null : null,
        websiteUrl: rc.websiteUrl != null ? String(rc.websiteUrl).trim() || null : null,
        runUrl: rc.runUrl != null ? String(rc.runUrl).trim() || null : null,
        stravaUrl: rc.stravaUrl != null ? String(rc.stravaUrl).trim() || null : null,
        description: rc.description != null ? String(rc.description).trim() || null : null,
        allRunsDescription: rc.allRunsDescription != null ? String(rc.allRunsDescription).trim() || null : null,  // Description of the runs themselves — drives downstream run_series
        logoUrl: rc.logoUrl != null ? String(rc.logoUrl).trim() || null : null,
        syncedAt: new Date(),
      };
      if (id) {
        runClub = await prisma.run_clubs.upsert({
          where: { id },
          create: { id, ...updateData },
          update: updateData,
          select: { id: true, name: true, slug: true, city: true, allRunsDescription: true },
        });
      } else {
        const existing = await prisma.run_clubs.findUnique({ where: { slug: slugFinal } });
        if (existing) {
          runClub = await prisma.run_clubs.update({
            where: { id: existing.id },
            data: updateData,
            select: { id: true, name: true, slug: true, city: true, allRunsDescription: true },
          });
        } else {
          runClub = await prisma.run_clubs.create({
            data: { ...updateData, slug: slugFinal },
            select: { id: true, name: true, slug: true, city: true, allRunsDescription: true },
          });
        }
      }
    }

    if (!runClub && runClubSlug?.trim()) {
      runClub = await prisma.run_clubs.findUnique({
        where: { slug: runClubSlug.trim() },
        select: { id: true, name: true, slug: true, city: true, allRunsDescription: true },
      });
    }
    if (!runClub && runClubId?.trim()) {
      runClub = await prisma.run_clubs.findUnique({
        where: { id: runClubId.trim() },
        select: { id: true, name: true, slug: true, city: true, allRunsDescription: true },
      });
    }
    if (!runClub) {
      return NextResponse.json({
        success: false,
        error: `Run club not found. Complete series starter (Set run series for this club) so runClub is synced.`,
      }, { status: 404 });
    }

    // CRITICAL: Ensure runClub.id exists - this is the FK that links series to club
    if (!runClub.id) {
      console.error('[run-series/create] runClub exists but has no id:', runClub);
      return NextResponse.json({
        success: false,
        error: `Run club has no ID. This should never happen.`,
      }, { status: 500 });
    }

    // Find or create the setup for this (runClubId + dayOfWeek) pair
    // For multi-site support: if meetUpCity is provided, also match by city to allow multiple series per day
    // Use the looked-up runClub.id (from run_clubs table) - THIS IS THE FK
    const whereClause: any = { runClubId: runClub.id, dayOfWeek: canonicalDay };
    if (meetUpCity?.trim()) {
      // Multi-site: match by city too, so same club can have multiple Tuesday runs at different locations
      whereClause.meetUpCity = meetUpCity.trim();
    }
    let setup = await prisma.run_series.findFirst({
      where: whereClause,
    });

    const baseName = name?.trim() || `${runClub.name} ${canonicalDay.charAt(0) + canonicalDay.slice(1).toLowerCase()} Run`;

    // Use provided description, or fall back to run_clubs.allRunsDescription (backwards compatible)
    const seriesDescription = description?.trim() || runClub.allRunsDescription || null;

    const setupData = {
      dayOfWeek: canonicalDay,
      runClubId: runClub.id, // FK: Links this series to run_clubs table - CRITICAL for hydration
      name: baseName,
      description: seriesDescription, // Derived from run_clubs.allRunsDescription if not provided
      gofastCity: gofastCity?.trim() || null,
      meetUpPoint: meetUpPoint?.trim() || null,
      meetUpStreetAddress: meetUpStreetAddress?.trim() || null,
      meetUpCity: meetUpCity?.trim() || null,
      meetUpState: meetUpState?.trim() || null,
      meetUpPlaceId: meetUpPlaceId?.trim() || null,
      meetUpLat: meetUpLat != null ? parseFloat(String(meetUpLat)) : null,
      meetUpLng: meetUpLng != null ? parseFloat(String(meetUpLng)) : null,
      startTimeHour: startTimeHour != null ? parseInt(String(startTimeHour), 10) : null,
      startTimeMinute: startTimeMinute != null ? parseInt(String(startTimeMinute), 10) : null,
      startTimePeriod: startTimePeriod?.trim() || null,
      startDate: seriesStartDate ? new Date(seriesStartDate) : null,
      endDate: seriesEndDate ? new Date(seriesEndDate) : null,
      updatedAt: new Date(),
    };

    if (setup) {
      setup = await prisma.run_series.update({
        where: { id: setup.id },
        data: setupData,
      });
      // Verify FK was set
      if (!setup.runClubId) {
        console.error('[run-series/create] Updated series but runClubId is null!', { seriesId: setup.id, runClubId: runClub.id });
      }
    } else {
      const slugBase = slugifyForSeries((runClub.slug || runClub.id) + '-' + canonicalDay.toLowerCase());
      const slug = await generateUniqueSeriesSlug(prisma, slugBase);
      setup = await prisma.run_series.create({
        data: {
          id: generateId(),
          ...setupData,
          slug,
          workflowStatus: 'DEVELOP',
        },
      });
      // Verify FK was set
      if (!setup.runClubId) {
        console.error('[run-series/create] Created series but runClubId is null!', { seriesId: setup.id, runClubId: runClub.id, setupData });
        throw new Error('Failed to set runClubId FK on series creation');
      }
    }

    // MVP1: series-only — no dual mutation. When createFirstRun is false, return just the series.
    if (!createRun) {
      const response = NextResponse.json({
        success: true,
        setup,
        run: null,
        isNewSetup: !setup,
        seriesOnly: true,
      });
      Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    }

    // Create the first city_run stub seeded from setup (when createFirstRun !== false)
    const runDate = firstRunDate
      ? new Date(firstRunDate)
      : getNextOccurrence(canonicalDay);

    const formattedDate = runDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const runTitle = `${setup.name} – ${formattedDate}`;

    if (!setup.gofastCity && !meetUpCity) {
      return NextResponse.json({ success: false, error: 'gofastCity or meetUpCity is required to create the first run' }, { status: 400 });
    }

    const finalCitySlug = setup.gofastCity || slugify(meetUpCity || '');

    const runId = generateId();
    const run = await prisma.city_runs.create({
      data: {
        id: runId,
        runSeriesId: setup.id,
        runClubId: runClub.id, // Use looked-up runClub.id from run_clubs table
        staffGeneratedId: staffGeneratedId.trim(),
        title: runTitle,
        workflowStatus: 'DEVELOP',
        dayOfWeek: canonicalDay,
        date: runDate,
        gofastCity: finalCitySlug,
        meetUpPoint: setup.meetUpPoint || '',
        meetUpStreetAddress: setup.meetUpStreetAddress || null,
        meetUpCity: setup.meetUpCity || null,
        meetUpState: setup.meetUpState || null,
        meetUpPlaceId: setup.meetUpPlaceId || null,
        meetUpLat: setup.meetUpLat || null,
        meetUpLng: setup.meetUpLng || null,
        startTimeHour: setup.startTimeHour || null,
        startTimeMinute: setup.startTimeMinute || null,
        startTimePeriod: setup.startTimePeriod || null,
        description: setup.description || null,
        updatedAt: new Date(),
      },
    });

    const response = NextResponse.json({
      success: true,
      setup,
      run,
      isNewSetup: !setup,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: any) {
    console.error('[POST /api/run-series/create] Error:', error);
    const response = NextResponse.json(
      { success: false, error: 'Failed to create series setup', details: error?.message },
      { status: 500 }
    );
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

const DAY_ORDER: Record<string, number> = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
  THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

function getNextOccurrence(canonicalDay: string): Date {
  const target = DAY_ORDER[canonicalDay] ?? 1;
  const today = new Date();
  const currentDay = today.getDay();
  let daysUntil = (target - currentDay + 7) % 7;
  if (daysUntil === 0) daysUntil = 7; // always next week if today
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  next.setHours(0, 0, 0, 0);
  return next;
}

function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function slugifyForSeries(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'series';
}

async function generateUniqueSeriesSlug(prisma: { run_series: { findFirst: (args: { where: { slug: string } }) => Promise<{ id: string } | null> } }, base: string): Promise<string> {
  let slug = base;
  let n = 1;
  while (await prisma.run_series.findFirst({ where: { slug } })) {
    slug = `${base}-${n}`;
    n++;
  }
  return slug;
}
