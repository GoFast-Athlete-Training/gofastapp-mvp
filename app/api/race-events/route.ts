import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { parseRace } from '@/lib/runsignup/raceParser';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable all caching
export const fetchCache = 'force-no-store'; // Disable fetch caching

/**
 * POST /api/race-events
 * 
 * Server-side API route that fetches upcoming events from RunSignUp.
 * Accepts athleteId from request body (client sends from localStorage).
 * Verifies athleteId matches Firebase token for authorization.
 * Uses athlete's state to filter races.
 * 
 * Request body: { athleteId: string }
 * 
 * Returns normalized list of upcoming events (limit 5 for MVP).
 */

export async function POST(request: Request) {
  try {
    // ============================================================
    // STAGE 0: GET ATHLETE LOCATION (for filtering)
    // ============================================================
    let filterState = 'VA'; // Default to Virginia
    
    // 1. Parse request body to get athleteId
    let body: any = {};
    try {
      body = await request.json();
    } catch {}
    
    const { athleteId } = body;
    
    // 2. Verify Firebase token (for authentication)
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

    // 3. Get athlete and verify athleteId matches Firebase token
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // If athleteId provided, verify it matches
    if (athleteId && athlete.id !== athleteId) {
      return NextResponse.json({ error: 'Athlete ID mismatch' }, { status: 403 });
    }
    
    // 4. Use athlete's state for filtering
    if (athlete?.state) {
      filterState = athlete.state.toUpperCase();
      console.log(`📍 Filtering races by athlete location: ${filterState} (athleteId: ${athlete.id})`);
    } else {
      console.log(`📍 No athlete state found, defaulting to: ${filterState} (athleteId: ${athlete.id})`);
    }

    // ============================================================
    // STAGE 1: URL BUILDING (Request Construction)
    // ============================================================
    const apiKey = process.env.RUNSIGNUP_API_KEY;
    const apiSecret = process.env.RUNSIGNUP_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ RunSignUp credentials missing from environment');
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: 'Missing RunSignUp credentials'
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // STEP 1: Over-fetch (Required)
    // WHY: RunSignUp returns everything (races, training programs, ticket events)
    // We need to fetch many results, normalize, then select the best ones
    // Do NOT try to out-smart the API with distance filters or event_type params
    const url = new URL('https://api.runsignup.com/rest/races');
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('api_secret', apiSecret);
    url.searchParams.append('format', 'json');
    url.searchParams.append('page', '1');
    url.searchParams.append('results_per_page', '100'); // Over-fetch to have options
    
    // Filter by state (athlete's location or default to VA)
    url.searchParams.append('state', filterState);
    
    // Sort by date (upcoming first)
    url.searchParams.append('sort', 'date');
    url.searchParams.append('sort_dir', 'asc'); // Ascending = upcoming first
    
    // Include race details
    url.searchParams.append('events', 'T');
    url.searchParams.append('race_links', 'T');
    url.searchParams.append('race_headings', 'T');
    
    // Note: Removed event_type and min_distance filters - RunSignUp API might not support them
    // We'll filter client-side instead
    
    console.log(`🔍 Calling RunSignUp API: ${url.toString().replace(apiKey, '***').replace(apiSecret, '***')}`);

    // ============================================================
    // STAGE 2: PUSH TO SIGNUP SERVER (HTTP Fetch)
    // ============================================================
    // CRITICAL: Clean-room fetch with NO auth headers
    // WHY: Firebase Bearer tokens are ONLY for our API, never forwarded to RunSignUp
    // - No Authorization header
    // - No cookies
    // - No session headers
    // - No shared axios/fetch wrappers that might leak auth
    // RunSignUp uses api_key/api_secret in URL params only
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // DO NOT add Authorization, Cookie, or any auth headers
      },
    });

    // Capture raw response text (can only read once!)
    const rawResponseText = await response.text();

    if (!response.ok) {
      console.error('❌ RunSignUp API error:', response.status, response.statusText);
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: `RunSignUp API returned ${response.status}: ${response.statusText}`
      }, { 
        status: response.status,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // ============================================================
    // STAGE 3: JSON ACCEPTOR (Parse + Validate)
    // ============================================================
    let data;
    try {
      data = JSON.parse(rawResponseText);
    } catch (parseError: any) {
      console.error('❌ Failed to parse RunSignUp response as JSON:', parseError.message);
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: 'Failed to parse RunSignUp response as JSON'
      }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // Validate structure
    if (!data.races || !Array.isArray(data.races)) {
      console.error('❌ RunSignUp response invalid structure:', JSON.stringify(data, null, 2));
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: 'RunSignUp response missing races array'
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    console.log(`🔍 RunSignUp returned ${data.races.length} races (before filtering)`);

    // ============================================================
    // STAGE 4: NORMALIZE + SELECT (Response Contract)
    // ============================================================
    // STEP 2: Normalize (NO filtering yet)
    // Extract race objects from wrapper objects (data.races[i].race)
    const rawRaces = (data.races || [])
      .map((r: any) => r.race)
      .filter(Boolean);

    console.log(`🔍 RunSignUp returned ${rawRaces.length} total items (before normalization)`);

    // Normalize all races (classify but don't filter)
    // WHY: We need to see what we have before selecting
    const normalizedRaces = rawRaces.map((race: any) => {
      return parseRace(race);
    });

    // Log category breakdown
    const categoryCounts = normalizedRaces.reduce((acc: any, race: any) => {
      acc[race.category] = (acc[race.category] || 0) + 1;
      return acc;
    }, {});
    console.log(`📊 Category breakdown:`, categoryCounts);

    // STEP 3: Select for MVP1
    // Filter out past events (only show upcoming races)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today for comparison
    
    const isUpcoming = (race: any) => {
      if (!race.startDate) return false; // Exclude races without dates
      try {
        const raceDate = new Date(race.startDate);
        raceDate.setHours(0, 0, 0, 0);
        return raceDate >= today;
      } catch {
        return false; // Invalid date, exclude it
      }
    };
    
    const upcomingRaces = normalizedRaces.filter((r: any) => r.category === 'race' && isUpcoming(r));
    const upcomingTrainingPrograms = normalizedRaces.filter((r: any) => r.category === 'training_program' && isUpcoming(r));
    
    console.log(`📅 Date filtering: ${normalizedRaces.filter((r: any) => r.category === 'race').length} total races → ${upcomingRaces.length} upcoming`);
    
    // Prefer category === 'race', take first 10-20 races
    // If no races found, fall back to training programs
    // Never return empty list unless API returned zero items
    const races = upcomingRaces;
    const trainingPrograms = upcomingTrainingPrograms;
    
    let selectedEvents: any[];
    if (races.length > 0) {
      // Prefer actual races
      selectedEvents = races.slice(0, 20); // Take up to 20 races
      console.log(`✅ Selected ${selectedEvents.length} races (from ${races.length} available)`);
    } else if (trainingPrograms.length > 0) {
      // Fallback to training programs if no races
      selectedEvents = trainingPrograms.slice(0, 10); // Take up to 10 training programs
      console.log(`⚠️ No races found, falling back to ${selectedEvents.length} training programs`);
    } else {
      // Only "other" category items or empty
      selectedEvents = normalizedRaces.slice(0, 10);
      console.log(`⚠️ No races or training programs, showing ${selectedEvents.length} other items`);
    }

    // Return all selected events (no limit for accordion view with filtering)
    const events = selectedEvents;
    
    // DEBUG: Log first event details
    if (events.length > 0) {
      console.log('🔍 DEBUG: First event being returned:', {
        name: events[0].name,
        category: events[0].category,
        url: events[0].url,
        has_url: !!events[0].url,
      });
    }

    console.log(`✅ Returning ${events.length} events to client (filterState: ${filterState})`);
    console.log(`🔍 Events being returned:`, JSON.stringify(events, null, 2));

    if (events.length === 0) {
      console.warn('⚠️ No events after filtering - check RunSignUp API response and filters');
      console.warn('⚠️ This could mean:');
      console.warn('   - All races were training programs (filtered out)');
      console.warn('   - No races match the state filter');
      console.warn('   - RunSignUp returned no races for this state');
    }

    // Always return success: true with events array (even if empty)
    // Client will handle empty array by showing "No upcoming races found"
    return NextResponse.json({
      success: true,
      events: events, // Always an array, may be empty
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching events from RunSignUp:', error.message);
    return NextResponse.json({ 
      success: false, 
      events: [],
      error: error.message || 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}

/**
 * GET /api/race-events
 * 
 * BLOCKED: This endpoint requires POST with athleteId in body.
 * GET requests are not supported to prevent caching and ensure athlete context.
 */
export async function GET() {
  console.warn('⚠️ GET /api/race-events called - this endpoint requires POST');
  return NextResponse.json({ 
    success: false, 
    events: [],
    error: 'This endpoint requires POST method with athleteId in request body'
  }, { 
    status: 405, // Method Not Allowed
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Allow': 'POST',
    },
  });
}
