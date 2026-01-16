import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/race-events
 * 
 * Server-side API route that fetches upcoming events from RunSignUp.
 * Credentials are never exposed to the client.
 * 
 * Returns normalized list of upcoming events (limit ~10).
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
    // Using start_date=today to get upcoming events, results_per_page=10 to get more results
    const url = new URL('https://runsignup.com/rest/races');
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('api_secret', apiSecret);
    url.searchParams.append('format', 'json');
    url.searchParams.append('start_date', 'today');
    url.searchParams.append('results_per_page', '10');
    url.searchParams.append('race_links', 'T'); // Include race URLs

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        '❌ RunSignUp API error:',
        response.status,
        response.statusText
      );
      return NextResponse.json({ success: false, events: [] });
    }

    const data = await response.json();

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
      .slice(0, 10)
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

    return NextResponse.json({ success: true, events: normalizedEvents });
  } catch (error: any) {
    console.error('❌ Error fetching events from RunSignUp:', error);
    return NextResponse.json({ success: false, events: [] });
  }
}
