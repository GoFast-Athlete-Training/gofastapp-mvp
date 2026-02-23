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
 *   runClubId           string  (required)
 *   dayOfWeek           string  (required) — any format, normalised to canonical
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
 *   staffGeneratedId    string  (required) — creating staff member
 *   firstRunDate        string  (optional) — ISO date for the first city_run stub; defaults to next occurrence of dayOfWeek
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      runClubId,
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
    } = body;

    if (!runClubId?.trim()) {
      return NextResponse.json({ success: false, error: 'runClubId is required' }, { status: 400 });
    }
    if (!dayOfWeek?.trim()) {
      return NextResponse.json({ success: false, error: 'dayOfWeek is required' }, { status: 400 });
    }
    if (!staffGeneratedId?.trim()) {
      return NextResponse.json({ success: false, error: 'staffGeneratedId is required' }, { status: 400 });
    }

    const canonicalDay = toCanonicalDayOfWeek(dayOfWeek) ?? dayOfWeek.trim().toUpperCase();

    // Verify run club exists
    const runClub = await prisma.run_clubs.findUnique({
      where: { id: runClubId.trim() },
      select: { id: true, name: true, slug: true, city: true },
    });
    if (!runClub) {
      return NextResponse.json({ success: false, error: 'Run club not found' }, { status: 404 });
    }

    // Find or create the setup for this (runClubId + dayOfWeek) pair
    let setup = await prisma.run_series.findFirst({
      where: { runClubId: runClubId.trim(), dayOfWeek: canonicalDay },
    });

    const setupData = {
      dayOfWeek: canonicalDay,
      runClubId: runClubId.trim(),
      name: name?.trim() || `${runClub.name} ${canonicalDay.charAt(0) + canonicalDay.slice(1).toLowerCase()} Run`,
      description: description?.trim() || null,
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
      // Update existing setup with any new info provided
      setup = await prisma.run_series.update({
        where: { id: setup.id },
        data: setupData,
      });
    } else {
      setup = await prisma.run_series.create({
        data: { id: generateId(), ...setupData },
      });
    }

    // Create the first city_run stub seeded from setup
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
        runClubId: runClubId.trim(),
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
