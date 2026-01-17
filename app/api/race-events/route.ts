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

    // Build events with canonical URL from race_id only
    const events = races.slice(0, 5).map((race: any) => {
      // Canonical RunSignUp registration URL - use ONLY race_id
      const registrationUrl = race.race_id
        ? `https://runsignup.com/Race/${race.race_id}`
        : '';

      return {
        id: race.race_id,
        name: race.name,
        startDate: race.start_date,
        location: [race.city, race.state].filter(Boolean).join(', ') || '',
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
