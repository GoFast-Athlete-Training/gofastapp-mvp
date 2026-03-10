import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_COMPANY_APP_URL || 'https://gofasthq.gofastcrushgoals.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
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
    const { searchParams } = new URL(request.url);
    const dayOfWeekFilter = searchParams.get('dayOfWeek'); // Optional filter for single day

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
    let entries = parseRunSchedule(club.runSchedule);
    
    // Filter by dayOfWeek if provided
    if (dayOfWeekFilter) {
      const canonicalFilterDay = toCanonicalDay(dayOfWeekFilter);
      entries = entries.filter((entry) => toCanonicalDay(entry.day) === canonicalFilterDay);
    }
    
    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: dayOfWeekFilter ? `No schedule entries found for ${dayOfWeekFilter}` : 'No valid schedule entries found', runClubId: id },
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

    // Split a full place string (e.g. "D.C. Jefferson by the Washington Monument") into
    // structured city + location using the same heuristic as the Company app edit page.
    function splitPlaceString(placeText: string): { city: string; location: string } {
      const commonCityPatterns = [
        /^D\.C\./i, /^Washington$/i, /^Arlington$/i, /^Georgetown$/i,
        /^Bethesda$/i, /^Alexandria$/i, /^Fairfax$/i, /^Vienna$/i,
        /^Reston$/i, /^Tysons$/i, /^McLean$/i, /^Silver\s+Spring$/i,
        /^Rockville$/i, /^Gaithersburg$/i,
      ];
      const tokens = placeText.trim().split(/\s+/);
      const firstToken = tokens[0];
      const isCityPattern = commonCityPatterns.some((p) => p.test(firstToken));
      const isAbbreviation = /^[A-Z]\.([A-Z]\.)?$/i.test(firstToken);

      if (tokens.length >= 2 && firstToken.toLowerCase() === 'washington' && tokens[1] === 'D.C.') {
        return { city: firstToken, location: tokens.slice(1).join(' ') };
      } else if ((isCityPattern || isAbbreviation) && tokens.length > 1) {
        return { city: firstToken, location: tokens.slice(1).join(' ') };
      } else if (tokens.length === 1 && (isCityPattern || isAbbreviation)) {
        return { city: firstToken, location: '' };
      } else {
        return { city: '', location: placeText };
      }
    }

    // Process each entry
    const results = [];
    const usedSlugs = new Set<string>(); // Track slugs to prevent duplicates
    
    for (let idx = 0; idx < entries.length; idx++) {
      const entry = entries[idx];
      const canonicalDay = toCanonicalDay(entry.day);

      try {
        // entry.city = the full place blob from the parser: "D.C. Jefferson by the Washington Monument"
        // Split into structured city + location:
        //   meetUpCity  = "D.C."
        //   meetUpPoint = "Jefferson by the Washington Monument"
        const placeString = entry.city?.trim() || '';
        const { city: parsedCity, location: parsedLocation } = placeString
          ? splitPlaceString(placeString)
          : { city: '', location: '' };

        const meetUpCity = parsedCity || (isMultiSite ? (club.city?.trim() || null) : null) || null;
        const meetUpPoint = parsedLocation || null;

        const dayKey = meetUpCity ? `${canonicalDay}:${meetUpCity.toLowerCase()}` : canonicalDay;
        const existingSeriesId = existingByDay.get(dayKey);

        const { hour: startTimeHour, minute: startTimeMinute, period: startTimePeriod } = parseTime(entry.time);

        const citySuffix = isMultiSite && meetUpCity ? ` (${meetUpCity})` : '';
        const seriesName = `${club.name || 'Run Club'} ${entry.day} Run${citySuffix}`;

        const clubSlugBase = club.slug || club.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'run-club';
        const daySlug = canonicalDay.toLowerCase();
        const citySlug = meetUpCity ? `-${meetUpCity.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
        
        // Generate unique slug - add index suffix if slug already used
        let seriesSlug = `${clubSlugBase}-${daySlug}${citySlug}`;
        let slugSuffix = 1;
        while (usedSlugs.has(seriesSlug)) {
          seriesSlug = `${clubSlugBase}-${daySlug}${citySlug}-${slugSuffix}`;
          slugSuffix++;
        }
        usedSlugs.add(seriesSlug);

        if (existingSeriesId) {
          const updated = await prisma.run_series.update({
            where: { id: existingSeriesId },
            data: {
              name: seriesName,
              slug: seriesSlug,
              startTimeHour,
              startTimeMinute,
              startTimePeriod: startTimePeriod as 'AM' | 'PM' | null,
              meetUpPoint,
              meetUpCity,
            },
          });
          results.push({ action: 'updated', seriesId: updated.id, dayOfWeek: canonicalDay });
        } else {
          // Check if slug already exists in DB (race condition protection)
          const existingBySlug = await prisma.run_series.findUnique({
            where: { slug: seriesSlug },
            select: { id: true },
          });
          
          if (existingBySlug) {
            // Slug conflict - use existing series
            const updated = await prisma.run_series.update({
              where: { id: existingBySlug.id },
              data: {
                name: seriesName,
                startTimeHour,
                startTimeMinute,
                startTimePeriod: startTimePeriod as 'AM' | 'PM' | null,
                meetUpPoint,
                meetUpCity,
              },
            });
            results.push({ action: 'updated', seriesId: updated.id, dayOfWeek: canonicalDay });
          } else {
            const now = new Date();
            try {
              const created = await prisma.run_series.create({
                data: {
                  id: generateId(),
                  runClubId: club.id,
                  dayOfWeek: canonicalDay,
                  name: seriesName,
                  slug: seriesSlug,
                  startTimeHour,
                  startTimeMinute,
                  startTimePeriod: startTimePeriod as 'AM' | 'PM' | null,
                  meetUpPoint,
                  meetUpCity,
                  createdAt: now,
                  updatedAt: now,
                },
              });
              results.push({ action: 'created', seriesId: created.id, dayOfWeek: canonicalDay });
            } catch (createError: any) {
              // Handle unique constraint violation (duplicate slug)
              if (createError?.code === 'P2002') {
                console.warn(`[build-series-from-schedule] Slug conflict for ${seriesSlug}, trying to find existing series`);
                // Try to find existing series by slug and update it
                const existingBySlug = await prisma.run_series.findUnique({
                  where: { slug: seriesSlug },
                  select: { id: true, runClubId: true },
                });
                
                if (existingBySlug && existingBySlug.runClubId === club.id) {
                  // Update existing series
                  const updated = await prisma.run_series.update({
                    where: { id: existingBySlug.id },
                    data: {
                      name: seriesName,
                      startTimeHour,
                      startTimeMinute,
                      startTimePeriod: startTimePeriod as 'AM' | 'PM' | null,
                      meetUpPoint,
                      meetUpCity,
                    },
                  });
                  results.push({ action: 'updated', seriesId: updated.id, dayOfWeek: canonicalDay });
                } else {
                  // Generate new unique slug
                  let newSlug = seriesSlug;
                  let suffix = 1;
                  while (true) {
                    const checkSlug = `${seriesSlug}-${suffix}`;
                    const exists = await prisma.run_series.findUnique({
                      where: { slug: checkSlug },
                      select: { id: true },
                    });
                    if (!exists) {
                      newSlug = checkSlug;
                      break;
                    }
                    suffix++;
                  }
                  
                  const created = await prisma.run_series.create({
                    data: {
                      id: generateId(),
                      runClubId: club.id,
                      dayOfWeek: canonicalDay,
                      name: seriesName,
                      slug: newSlug,
                      startTimeHour,
                      startTimeMinute,
                      startTimePeriod: startTimePeriod as 'AM' | 'PM' | null,
                      meetUpPoint,
                      meetUpCity,
                      createdAt: now,
                      updatedAt: now,
                    },
                  });
                  results.push({ action: 'created', seriesId: created.id, dayOfWeek: canonicalDay });
                }
              } else {
                throw createError; // Re-throw if not a slug conflict
              }
            }
          }
        }
      } catch (error: any) {
        console.error(`[build-series-from-schedule] Error processing entry ${idx + 1} (${entry.day}):`, {
          error: error?.message,
          code: error?.code,
          meta: error?.meta,
          entry: entry.day,
          time: entry.time,
          city: entry.city,
        });
        // Continue processing other entries even if one fails
        results.push({ 
          action: 'error', 
          dayOfWeek: canonicalDay, 
          error: error?.message || 'Unknown error',
          code: error?.code,
          entry: entry.day,
        });
      }
    }

    const errors = results.filter((r) => r.action === 'error');
    const hasErrors = errors.length > 0;
    
    return NextResponse.json(
      {
        success: !hasErrors,
        runClubId: id,
        results,
        summary: {
          total: results.length,
          created: results.filter((r) => r.action === 'created').length,
          updated: results.filter((r) => r.action === 'updated').length,
          errors: errors.length,
        },
        ...(hasErrors && { errorDetails: errors }),
      },
      { headers: corsHeaders, status: hasErrors ? 207 : 200 } // 207 = Multi-Status (partial success)
    );
  } catch (error: any) {
    console.error('[build-series-from-schedule] Error:', {
      error: error?.message,
      stack: error?.stack,
      code: error?.code,
      meta: error?.meta,
      runClubId: id,
    });
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Failed to build series from schedule',
        details: error?.code === 'P2002' ? 'Duplicate slug detected - series may already exist' : error?.code,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
