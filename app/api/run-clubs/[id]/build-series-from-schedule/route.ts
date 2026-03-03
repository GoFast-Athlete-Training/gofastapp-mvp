import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCanonicalDayOfWeek } from '@/lib/utils/dayOfWeekConverter';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Parse runSchedule string (same format as Company app).
 * Format: "day Time place track url" per entry, comma-separated.
 */
type RunScheduleEntry = {
  day: string;
  frequency: string;
  time: string;
  miles: string;
  runType: string | null;
  city: string;
  url: string;
};

function parseRunSchedule(schedule: string | null | undefined): RunScheduleEntry[] {
  if (!schedule || !schedule.trim()) return [];

  const entries: RunScheduleEntry[] = [];
  const parts = schedule.split(',').map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    let remaining = part.trim();
    let frequency = 'weekly';
    let runType: string | null = null;

    const frequencyMatch = remaining.match(/^(first|second|third|fourth|last|weekly)\s+/i);
    if (frequencyMatch) {
      remaining = remaining.substring(frequencyMatch[0].length).trim();
    }

    const runTypePatterns = [
      { pattern: /\btrack\b/i, value: 'track' },
      { pattern: /\btrail\b/i, value: 'trail' },
      { pattern: /\bneighborhood\b/i, value: 'neighborhood' },
      { pattern: /\bpark\b/i, value: 'park' },
    ];
    
    for (const { pattern, value } of runTypePatterns) {
      if (pattern.test(remaining)) {
        runType = value;
        remaining = remaining.replace(pattern, '').trim();
        break;
      }
    }

    const day = remaining.match(/^([A-Za-z]+)/)?.[1] || '';
    if (!day) continue;

    remaining = remaining.substring(day.length).trim();

    let time = '';
    let city = '';
    let url = '';

    const urlMatch = remaining.match(/\s+(https?:\/\/[^\s]+)$/);
    if (urlMatch) {
      url = urlMatch[1];
      remaining = remaining.substring(0, remaining.length - url.length).trim();
    }

    const timeMatch = remaining.match(/^(\d{1,2}:\d{2}(?:\s+[ap]\.?m\.?|[AP]M)?)/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
      remaining = remaining.substring(timeMatch[0].length).trim();
    }

    remaining = remaining.replace(/\d+(-\d+)?\s*miles?/i, '').trim();
    remaining = remaining.replace(/\s*https?:\/\/[^\s]+/g, '').trim();
    city = remaining.replace(/^\(|\)$/g, '').trim();

    entries.push({
      day,
      frequency,
      time,
      miles: '',
      runType,
      city,
      url,
    });
  }

  return entries;
}

function toCanonicalDay(day: string): string {
  const map: Record<string, string> = {
    monday: 'MONDAY', mon: 'MONDAY',
    tuesday: 'TUESDAY', tue: 'TUESDAY', tues: 'TUESDAY',
    wednesday: 'WEDNESDAY', wed: 'WEDNESDAY',
    thursday: 'THURSDAY', thu: 'THURSDAY', thur: 'THURSDAY', thurs: 'THURSDAY',
    friday: 'FRIDAY', fri: 'FRIDAY',
    saturday: 'SATURDAY', sat: 'SATURDAY',
    sunday: 'SUNDAY', sun: 'SUNDAY',
  };
  return map[day.trim().toLowerCase()] ?? day.trim().toUpperCase();
}

function parseTime(timeStr: string | null | undefined): { hour: number | null; minute: number | null; period: string | null } {
  if (!timeStr) return { hour: null, minute: null, period: null };

  const timeMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?$/i);
  if (!timeMatch) return { hour: null, minute: null, period: null };

  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const period = timeMatch[3]?.toUpperCase() || null;

  // Convert to 12-hour format (1-12) with AM/PM
  if (period === 'AM') {
    return { hour: hour === 12 ? 12 : hour, minute, period: 'AM' };
  } else if (period === 'PM') {
    return { hour: hour === 12 ? 12 : hour, minute, period: 'PM' };
  } else {
    // No period - infer from hour (24-hour format)
    if (hour === 0) {
      return { hour: 12, minute, period: 'AM' };
    } else if (hour === 12) {
      return { hour: 12, minute, period: 'PM' };
    } else if (hour > 12) {
      return { hour: hour - 12, minute, period: 'PM' };
    } else {
      return { hour, minute, period: 'AM' };
    }
  }
}

/**
 * POST /api/run-clubs/[id]/build-series-from-schedule
 *
 * Build all series for a club from its runSchedule (club-scoped).
 * Parses runSchedule, matches existing series by dayOfWeek, creates/updates as needed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Load club with runSchedule
    const club = await prisma.run_clubs.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        runSchedule: true,
      },
    });

    if (!club) {
      return NextResponse.json(
        { success: false, error: 'Club not found', runClubId: id },
        { status: 404, headers: corsHeaders }
      );
    }

    if (!club.runSchedule || !club.runSchedule.trim()) {
      return NextResponse.json(
        { success: false, error: 'Club has no runSchedule', runClubId: id },
        { status: 400, headers: corsHeaders }
      );
    }

    // Parse schedule
    const entries = parseRunSchedule(club.runSchedule);
    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid schedule entries found', runClubId },
        { status: 400, headers: corsHeaders }
      );
    }

    // Load existing series for this club
    const existingSeries = await prisma.run_series.findMany({
      where: { runClubId: club.id },
      select: {
        id: true,
        dayOfWeek: true,
        meetUpCity: true,
      },
    });

    // Group existing series by dayOfWeek:city (for multi-site support)
    const existingByDay = new Map<string, string>(); // dayOfWeek:city -> seriesId
    existingSeries.forEach((s) => {
      const day = s.dayOfWeek?.toUpperCase() || '';
      const city = s.meetUpCity?.toLowerCase().trim() || '';
      const key = city ? `${day}:${city}` : day;
      existingByDay.set(key, s.id);
    });

    // Check for multi-site (multiple entries for same day)
    const dayCounts = new Map<string, number>();
    entries.forEach((entry) => {
      const canonicalDay = toCanonicalDay(entry.day);
      dayCounts.set(canonicalDay, (dayCounts.get(canonicalDay) || 0) + 1);
    });
    const isMultiSite = Array.from(dayCounts.values()).some((count) => count > 1);

    // Process each entry
    const results = [];
    for (const entry of entries) {
      const canonicalDay = toCanonicalDay(entry.day);
      const city = isMultiSite ? (club.city?.trim() || null) : null;
      const meetUpCity = isMultiSite ? city : null;
      const meetUpState = isMultiSite && meetUpCity ? null : null; // Could add state if available

      const dayKey = city ? `${canonicalDay}:${city.toLowerCase()}` : canonicalDay;
      const existingSeriesId = existingByDay.get(dayKey);

      const { hour: startTimeHour, minute: startTimeMinute, period: startTimePeriod } = parseTime(entry.time);

      const citySuffix = isMultiSite && city ? ` (${city})` : '';
      const seriesName = `${club.name || 'Run Club'} ${entry.day} Run${citySuffix}`;

      const clubSlugBase = club.slug || club.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'run-club';
      const daySlug = canonicalDay.toLowerCase();
      const citySlug = isMultiSite && club.city ? `-${club.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
      const seriesSlug = `${clubSlugBase}-${daySlug}${citySlug}`;

      if (existingSeriesId) {
        // Update existing series
        const updated = await prisma.run_series.update({
          where: { id: existingSeriesId },
          data: {
            name: seriesName,
            slug: seriesSlug,
            startTimeHour,
            startTimeMinute,
            startTimePeriod: startTimePeriod as 'AM' | 'PM' | null,
            meetUpCity,
            meetUpState,
          },
        });
        results.push({ action: 'updated', seriesId: updated.id, dayOfWeek: canonicalDay });
      } else {
        // Create new series
        const created = await prisma.run_series.create({
          data: {
            runClubId: club.id,
            dayOfWeek: canonicalDay,
            name: seriesName,
            slug: seriesSlug,
            startTimeHour,
            startTimeMinute,
            startTimePeriod: startTimePeriod as 'AM' | 'PM' | null,
            meetUpCity,
            meetUpState,
            createFirstRun: false,
          },
        });
        results.push({ action: 'created', seriesId: created.id, dayOfWeek: canonicalDay });
      }
    }

    return NextResponse.json(
      {
        success: true,
        runClubId: id,
        results,
        summary: {
          total: results.length,
          created: results.filter((r) => r.action === 'created').length,
          updated: results.filter((r) => r.action === 'updated').length,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[build-series-from-schedule] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to build series from schedule' },
      { status: 500, headers: corsHeaders }
    );
  }
}
