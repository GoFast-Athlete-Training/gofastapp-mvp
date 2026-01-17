import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
    const apiKey = process.env.RUNSIGNUP_API_KEY;
    const apiSecret = process.env.RUNSIGNUP_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ RunSignUp credentials missing from environment');
      return NextResponse.json({ success: false, events: [] });
    }

    // RunSignUp API endpoint for getting races
    // Using start_date=today to get upcoming events, results_per_page=5 for MVP
    const url = new URL('https://api.runsignup.com/rest/races');
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('api_secret', apiSecret);
    url.searchParams.append('format', 'json');
    // Note: start_date might need to be ISO format instead of 'today'
    // Try without start_date first, or use ISO format like '2025-01-01'
    // url.searchParams.append('start_date', 'today');
    url.searchParams.append('results_per_page', '5');
    url.searchParams.append('race_links', 'T'); // Include race URLs

    console.log('🔍 RACE EVENTS API: Calling RunSignUp endpoint...');
    console.log('📡 URL:', url.toString().replace(apiKey, '***').replace(apiSecret, '***'));
    console.log('🔑 Has credentials:', !!apiKey && !!apiSecret);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📦 RunSignUp API Response Status:', response.status, response.statusText);

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error response';
      }
      
      console.error('❌ RunSignUp API error:');
      console.error('  Status:', response.status, response.statusText);
      console.error('  Response body:', errorText);
      console.error('  Request URL:', url.toString().replace(apiKey, '***').replace(apiSecret, '***'));
      
      // Try to parse error as JSON
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: `RunSignUp API error (${response.status}): ${errorText || response.statusText}`,
        details: errorData,
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('📊 RunSignUp API Response Data:', {
      hasRaces: !!data.races,
      racesCount: data.races?.length || 0,
      dataKeys: Object.keys(data),
      sampleRace: data.races?.[0] ? {
        id: data.races[0].race_id || data.races[0].id,
        name: data.races[0].name,
      } : null,
    });

    // Normalize events from RunSignUp response
    // RunSignUp API returns races in data.races array
    const races = data.races || [];
    const now = new Date();

    const normalizedEvents = races
      .filter((race: any) => {
        // Filter for upcoming events (API should already filter with start_date=today, but double-check)
        const startDate = race.start_date || race.event_date;
        if (!startDate) return false;
        const eventDate = new Date(startDate);
        return eventDate >= now;
      })
      .slice(0, 5)
      .map((race: any) => {
        // Extract location
        const city = race.city || '';
        const state = race.state || '';
        const location = [city, state].filter(Boolean).join(', ') || 'Location TBD';

        // Extract URL - RunSignUp race page URL
        const raceId = race.race_id || race.id;
        const url =
          race.race_url ||
          (race.url_string ? `https://runsignup.com${race.url_string}` : '') ||
          (raceId ? `https://runsignup.com/Race/${raceId}` : '');

        // Extract race type and distance from events if available
        let raceType = '';
        let miles = null;
        
        if (race.events && race.events.length > 0) {
          // Get the first event's type and distance
          const firstEvent = race.events[0];
          raceType = firstEvent.event_type || '';
          if (firstEvent.distance) {
            const distance = parseFloat(firstEvent.distance);
            const units = firstEvent.distance_units || 'miles';
            if (units === 'miles') {
              miles = distance;
            } else if (units === 'kilometers') {
              miles = distance * 0.621371; // Convert km to miles
            }
          }
        }

        return {
          id: String(raceId || ''),
          name: race.name || 'Untitled Event',
          startDate: race.start_date || race.event_date || '',
          location: location,
          url: url,
          raceType: raceType,
          miles: miles,
        };
      });

    console.log('✅ RACE EVENTS: Returning', normalizedEvents.length, 'events');
    return NextResponse.json({ success: true, events: normalizedEvents });
  } catch (error: any) {
    console.error('❌ Error fetching events from RunSignUp:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    return NextResponse.json({ 
      success: false, 
      events: [],
      error: error.message || 'Unknown error',
    });
  }
}
