import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable all caching
export const fetchCache = 'force-no-store'; // Disable fetch caching

/**
 * GET /api/race-events
 * 
 * Server-side API route that fetches upcoming events from RunSignUp.
 * Credentials are never exposed to the client.
 * 
 * Returns normalized list of upcoming events (limit 5 for MVP).
 */

export async function GET() {
  try {
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

    // Build URL with required params
    const url = new URL('https://api.runsignup.com/rest/races');
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('api_secret', apiSecret);
    url.searchParams.append('format', 'json');
    url.searchParams.append('page', '1');
    url.searchParams.append('results_per_page', '5');
    url.searchParams.append('events', 'T');
    url.searchParams.append('race_links', 'T');
    url.searchParams.append('race_headings', 'T');

    // ============================================================
    // STAGE 2: PUSH TO SIGNUP SERVER (HTTP Fetch)
    // ============================================================
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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
      console.error('❌ RunSignUp response invalid structure');
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

    // Build events with proper URL format: /Race/STATE/CITY/URL_STRING
    const events = races.slice(0, 5).map((race: any) => {
      // Build URL using proper RunSignUp format: /Race/STATE/CITY/URL_STRING
      let registrationUrl = '';
      
      if (race.url_string) {
        // url_string might be relative (/Race/VA/Arlington/DCRRCSpringTraining) or absolute
        if (race.url_string.startsWith('http')) {
          registrationUrl = race.url_string;
        } else if (race.url_string.startsWith('/')) {
          registrationUrl = `https://runsignup.com${race.url_string}`;
        } else {
          // Build from state/city/url_string if we have all pieces
          if (race.state && race.city && race.url_string) {
            const stateCode = race.state.toUpperCase();
            const cityName = race.city.replace(/\s+/g, ''); // Remove spaces
            registrationUrl = `https://runsignup.com/Race/${stateCode}/${cityName}/${race.url_string}`;
          }
        }
      } else if (race.state && race.city && race.name) {
        // Fallback: try to construct from available fields
        const stateCode = race.state.toUpperCase();
        const cityName = race.city.replace(/\s+/g, '');
        // Use race name as url_string (slugified)
        const urlSlug = race.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '')
          .substring(0, 50);
        registrationUrl = `https://runsignup.com/Race/${stateCode}/${cityName}/${urlSlug}`;
      } else if (race.race_id) {
        // Last resort: use race_id (but this might 404)
        registrationUrl = `https://runsignup.com/Race/${race.race_id}`;
      }

      return {
        id: String(race.race_id || ''),
        name: race.name || 'Untitled Event',
        startDate: race.start_date || null,
        location: [race.city, race.state].filter(Boolean).join(', ') || 'Location TBD',
        url: registrationUrl,
      };
    });

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
