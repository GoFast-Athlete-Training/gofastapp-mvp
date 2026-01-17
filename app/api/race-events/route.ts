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
  console.log('🚀 RACE EVENTS API: Route hit');
  
  try {
    const apiKey = process.env.RUNSIGNUP_API_KEY;
    const apiSecret = process.env.RUNSIGNUP_API_SECRET;

    console.log('🔑 RACE EVENTS API: Env vars check');
    console.log('  - RUNSIGNUP_API_KEY exists:', !!apiKey);
    console.log('  - RUNSIGNUP_API_SECRET exists:', !!apiSecret);
    console.log('  - API Key length:', apiKey?.length || 0);
    console.log('  - API Secret length:', apiSecret?.length || 0);

    if (!apiKey || !apiSecret) {
      console.error('❌ RunSignUp credentials missing from environment');
      return NextResponse.json({ success: false, events: [], error: 'Missing credentials' });
    }

    // RunSignUp API endpoint for getting races
    const url = new URL('https://api.runsignup.com/rest/races');
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('api_secret', apiSecret);
    url.searchParams.append('format', 'json');
    url.searchParams.append('results_per_page', '5');
    url.searchParams.append('race_links', 'T');

    const finalUrl = url.toString();
    const maskedUrl = finalUrl.replace(apiKey, '***').replace(apiSecret, '***');
    
    console.log('🔍 RACE EVENTS API: Calling RunSignUp endpoint...');
    console.log('📡 EXACT URL (masked):', maskedUrl);
    console.log('📡 URL params:', {
      api_key: '***',
      api_secret: '***',
      format: 'json',
      results_per_page: '5',
      race_links: 'T'
    });

    console.log('📤 RACE EVENTS API: Sending fetch request...');
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📦 RunSignUp API Response:');
    console.log('  - HTTP Status:', response.status);
    console.log('  - Status Text:', response.statusText);
    console.log('  - OK:', response.ok);
    console.log('  - Headers:', Object.fromEntries(response.headers.entries()));

    // Get raw response text first (can only read once!)
    const rawResponseText = await response.text();
    console.log('📄 Raw Response (first 500 chars):', rawResponseText.substring(0, 500));
    console.log('📄 Raw Response (full length):', rawResponseText.length, 'characters');

    if (!response.ok) {
      console.error('❌ RunSignUp API error:');
      console.error('  Status:', response.status, response.statusText);
      console.error('  Raw response body:', rawResponseText);
      console.error('  Request URL (masked):', maskedUrl);
      
      let errorData;
      try {
        errorData = JSON.parse(rawResponseText);
        console.error('  Parsed error:', errorData);
      } catch {
        errorData = { message: rawResponseText };
        console.error('  Could not parse error as JSON');
      }
      
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: `RunSignUp API error (${response.status}): ${rawResponseText || response.statusText}`,
        debug: {
          status: response.status,
          statusText: response.statusText,
          rawResponse: rawResponseText.substring(0, 500),
          parsedError: errorData
        }
      }, { status: response.status });
    }

    // Parse JSON safely from the already-read text
    let data;
    try {
      data = JSON.parse(rawResponseText);
      console.log('✅ Successfully parsed JSON response');
    } catch (parseError: any) {
      console.error('❌ Failed to parse JSON response:');
      console.error('  Parse error:', parseError.message);
      console.error('  Raw response:', rawResponseText);
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: 'Failed to parse RunSignUp response as JSON',
        debug: {
          parseError: parseError.message,
          rawResponse: rawResponseText.substring(0, 500)
        }
      }, { status: 500 });
    }

    console.log('📊 RunSignUp API Response Structure:');
    console.log('  - Top-level keys:', Object.keys(data));
    console.log('  - Has races property:', !!data.races);
    console.log('  - Races type:', typeof data.races);
    console.log('  - Races length:', Array.isArray(data.races) ? data.races.length : 'NOT AN ARRAY');
    
    if (Array.isArray(data.races) && data.races.length > 0) {
      const firstRace = data.races[0];
      console.log('📋 First Race Object Structure:');
      console.log('  - Keys:', Object.keys(firstRace));
      console.log('  - race_id:', firstRace.race_id);
      console.log('  - id:', firstRace.id);
      console.log('  - name:', firstRace.name);
      console.log('  - url_string:', firstRace.url_string);
      console.log('  - race_links:', firstRace.race_links);
      console.log('  - race_url:', firstRace.race_url);
      console.log('  - Full first race object:', JSON.stringify(firstRace, null, 2).substring(0, 1000));
    }

    // MVP1 DEBUG MODE: Return raw races with URL construction logging
    const races = data.races || [];
    console.log('🔄 Processing', races.length, 'races from RunSignUp');

    const events = races.map((race: any, index: number) => {
      console.log(`\n🔍 Processing race #${index + 1}:`);
      console.log('  Input fields:', {
        race_id: race.race_id,
        id: race.id,
        url_string: race.url_string,
        race_links: race.race_links,
        race_url: race.race_url
      });

      // URL Construction Logic (explicit logging)
      let computedUrl = '';
      
      if (race.race_url) {
        computedUrl = race.race_url;
        console.log('  ✅ Using race.race_url:', computedUrl);
      } else if (race.url_string) {
        computedUrl = `https://runsignup.com${race.url_string}`;
        console.log('  ✅ Built from url_string:', computedUrl);
      } else if (race.race_links?.self) {
        computedUrl = race.race_links.self;
        console.log('  ✅ Using race_links.self:', computedUrl);
      } else if (race.race_id || race.id) {
        const raceId = race.race_id || race.id;
        computedUrl = `https://runsignup.com/Race/${raceId}`;
        console.log('  ✅ Built from race_id:', computedUrl);
      } else {
        computedUrl = '';
        console.log('  ❌ No URL fields found - using empty string');
      }

      console.log('  📍 Final computed URL:', computedUrl);

      // Return raw race + computed URL only
      return {
        race_id: race.race_id || race.id || null,
        name: race.name || 'Untitled Event',
        start_date: race.start_date || race.event_date || null,
        city: race.city || null,
        state: race.state || null,
        debug_url_inputs: {
          race_id: race.race_id,
          id: race.id,
          url_string: race.url_string,
          race_links: race.race_links,
          race_url: race.race_url,
        },
        url: computedUrl
      };
    });

    console.log('✅ RACE EVENTS: Returning', events.length, 'events');
    console.log('📤 Response payload preview:', JSON.stringify(events.slice(0, 2), null, 2));
    
    return NextResponse.json({ success: true, events });
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
