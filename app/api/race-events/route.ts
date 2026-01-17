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

    // Build URL with required params + filters to get REAL races
    const url = new URL('https://api.runsignup.com/rest/races');
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('api_secret', apiSecret);
    url.searchParams.append('format', 'json');
    url.searchParams.append('page', '1');
    url.searchParams.append('results_per_page', '5');
    
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
    // STAGE 4: PUSH TO CLIENT (Response Contract)
    // ============================================================
    // Extract race objects from wrapper objects (data.races[i].race)
    const races = (data.races || [])
      .map((r: any) => r.race)
      .filter(Boolean);

    // DEBUG: Log first race to see what we're actually getting
    if (races.length > 0) {
      console.log('🔍 DEBUG: First race object from RunSignUp:', JSON.stringify(races[0], null, 2));
      console.log('🔍 DEBUG: Available fields:', Object.keys(races[0]));
    }

    // Filter out non-race events (training programs, ticket events, etc.)
    // RunSignUp returns training programs mixed with actual races
    const realRaces = races.filter((race: any) => {
      const name = (race.name || '').toLowerCase();
      
      // Exclude training programs and workshops (these are not races)
      const isTraining = name.includes('training program') || 
                        name.includes('training group') ||
                        name.includes('workshop');
      
      // Exclude ticket events
      const isTicketEvent = name.includes('ticket');
      
      // Check if race has events with distance (distance is at event level, not race level)
      const hasEventWithDistance = race.events && Array.isArray(race.events) && 
        race.events.some((event: any) => {
          const distance = event.distance ? parseFloat(event.distance) : null;
          return distance && distance >= 1; // At least 1 mile
        });
      
      // Also check race-level distance as fallback
      const hasRaceDistance = race.distance && parseFloat(race.distance) >= 1;
      
      // Include if it's NOT a training program/ticket event AND has distance info
      return !isTraining && !isTicketEvent && (hasEventWithDistance || hasRaceDistance);
    });

    // Parse races using strict pass-through parser (NO URL INVENTION)
    // All URL logic is in lib/runsignup/raceParser.ts - this route never constructs URLs
    const events = realRaces.slice(0, 5).map((race: any) => {
      const parsed = parseRace(race);
      
      // DEBUG: Log URL extraction for first race
      if (realRaces.indexOf(race) === 0) {
        console.log('🔍 DEBUG: URL extraction (strict pass-through):', {
          race_url: race.url,
          url_string: race.url_string,
          extracted_url: parsed.url,
          has_url: !!parsed.url,
        });
      }

      return parsed;
    });
    
    // Log what we filtered out
    if (races.length > realRaces.length) {
      console.log(`🔍 Filtered out ${races.length - realRaces.length} non-race events (training programs, ticket events, etc.)`);
    }

    console.log(`✅ Returning ${events.length} events to client (filterState: ${filterState})`);

    if (events.length === 0) {
      console.warn('⚠️ No events after filtering - check RunSignUp API response and filters');
    }

    return NextResponse.json({
      success: true,
      events: events,
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
