import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/race-events
 * 
 * MVP1 MODULAR DEBUG PIPELINE
 * 
 * Four explicit stages:
 * 1. URL BUILDING - Construct RunSignUp request URL
 * 2. PUSH TO SIGNUP SERVER - Execute fetch, capture raw response
 * 3. JSON ACCEPTOR - Parse and validate structure
 * 4. PUSH TO CLIENT - Return response contract
 */

export async function GET() {
  console.log('🚀 RACE EVENTS API: Route hit');

  try {
    // ============================================================
    // STAGE 1: URL BUILDING (Request Construction)
    // ============================================================
    console.log('\n📐 STAGE 1: URL BUILDING');
    
    const apiKey = process.env.RUNSIGNUP_API_KEY;
    const apiSecret = process.env.RUNSIGNUP_API_SECRET;

    console.log('  - RUNSIGNUP_API_KEY exists:', !!apiKey);
    console.log('  - RUNSIGNUP_API_SECRET exists:', !!apiSecret);
    console.log('  - API Key length:', apiKey?.length || 0);
    console.log('  - API Secret length:', apiSecret?.length || 0);

    if (!apiKey || !apiSecret) {
      console.error('  ❌ Missing credentials');
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: 'Missing RunSignUp credentials'
      });
    }

    // Build URL - RunSignUp requires specific params to return race data
    const url = new URL('https://api.runsignup.com/rest/races');
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('api_secret', apiSecret);
    url.searchParams.append('format', 'json');
    url.searchParams.append('page', '1');
    url.searchParams.append('results_per_page', '5');
    url.searchParams.append('events', 'T'); // Include events in race objects
    url.searchParams.append('race_links', 'T'); // Include race URLs
    url.searchParams.append('race_headings', 'T'); // Include race headings/metadata

    const finalUrl = url.toString();
    const maskedUrl = finalUrl.replace(apiKey, '***').replace(apiSecret, '***');

    console.log('  ✅ URL constructed');
    console.log('  📡 FULL URL (masked):', maskedUrl);
    console.log('  📋 URL params:', {
      api_key: '***',
      api_secret: '***',
      format: 'json',
      page: '1',
      results_per_page: '5'
    });

    // ============================================================
    // STAGE 2: PUSH TO SIGNUP SERVER (HTTP Fetch)
    // ============================================================
    console.log('\n📤 STAGE 2: PUSH TO SIGNUP SERVER');
    console.log('  - Executing fetch...');

    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('  ✅ Fetch completed');
    console.log('  📦 HTTP Response:');
    console.log('    - response.ok:', response.ok);
    console.log('    - response.status:', response.status);
    console.log('    - response.statusText:', response.statusText);

    // Capture raw response text (can only read once!)
    const rawResponseText = await response.text();
    console.log('  📄 Raw Response Text:');
    console.log('    - Length:', rawResponseText.length, 'characters');
    console.log('    - First 500 chars:', rawResponseText.substring(0, 500));

    if (!response.ok) {
      console.error('  ❌ HTTP Error - NOT OK');
      console.error('    - Status:', response.status, response.statusText);
      console.error('    - Raw response:', rawResponseText);
      
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: `RunSignUp API returned ${response.status}: ${response.statusText}`,
        debug: {
          status: response.status,
          statusText: response.statusText,
          rawResponse: rawResponseText.substring(0, 500)
        }
      }, { status: response.status });
    }

    // ============================================================
    // STAGE 3: JSON ACCEPTOR (Parse + Validate)
    // ============================================================
    console.log('\n🔍 STAGE 3: JSON ACCEPTOR');
    console.log('  - Attempting JSON parse...');

    let data;
    try {
      data = JSON.parse(rawResponseText);
      console.log('  ✅ JSON Parse SUCCESS');
    } catch (parseError: any) {
      console.error('  ❌ JSON Parse FAILED');
      console.error('    - Error:', parseError.message);
      console.error('    - Raw response:', rawResponseText);
      
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

    // Validate structure
    console.log('  - Validating response structure...');
    console.log('    - Top-level keys:', Object.keys(data));
    console.log('    - Has data.races:', !!data.races);
    console.log('    - data.races type:', typeof data.races);
    console.log('    - data.races is array:', Array.isArray(data.races));

    if (!data.races) {
      console.error('  ❌ Structure validation FAILED - no data.races');
      console.error('    - Available keys:', Object.keys(data));
      
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: 'RunSignUp response missing races property',
        debug: {
          topLevelKeys: Object.keys(data),
          dataSample: JSON.stringify(data).substring(0, 500)
        }
      });
    }

    if (!Array.isArray(data.races)) {
      console.error('  ❌ Structure validation FAILED - data.races is not an array');
      console.error('    - data.races type:', typeof data.races);
      
      return NextResponse.json({ 
        success: false, 
        events: [],
        error: 'RunSignUp response races property is not an array',
        debug: {
          racesType: typeof data.races,
          racesValue: data.races
        }
      });
    }

    console.log('  ✅ Structure validation SUCCESS');
    console.log('    - Races count:', data.races.length);

    // Log FIRST race object in DETAIL to see actual structure
    if (data.races.length > 0) {
      const firstWrapper = data.races[0];
      console.log('\n🔬 DETAILED FIRST RACE WRAPPER INSPECTION:');
      console.log('    - Type:', typeof firstWrapper);
      console.log('    - All keys:', Object.keys(firstWrapper || {}));
      console.log('    - Has .race property:', !!firstWrapper?.race);
      console.log('    - Full wrapper object (JSON):', JSON.stringify(firstWrapper, null, 2).substring(0, 2000));
      
      if (firstWrapper?.race) {
        const firstRace = firstWrapper.race;
        console.log('    - .race object keys:', Object.keys(firstRace));
        console.log('    - .race.race_id:', firstRace.race_id);
        console.log('    - .race.name:', firstRace.name);
        console.log('    - .race.url_string:', firstRace.url_string);
      }
    }

    // ============================================================
    // STAGE 4: PUSH TO CLIENT (Response Contract)
    // ============================================================
    console.log('\n📥 STAGE 4: PUSH TO CLIENT');
    console.log('  - Extracting race objects from wrappers...');

    // Extract race objects from wrapper objects (data.races[i].race)
    const races = (data.races || [])
      .map((r: any) => r.race)
      .filter(Boolean);

    console.log('  - Extracted races count:', races.length);
    if (races.length > 0) {
      const firstRace = races[0];
      console.log('    - First extracted race keys:', Object.keys(firstRace));
      console.log('    - First extracted race.race_id:', firstRace.race_id);
      console.log('    - First extracted race.name:', firstRace.name);
    }

    // Build events with correct race data
    const events = races.slice(0, 5).map((race: any, index: number) => {
      console.log(`\n🔗 Building URL for race #${index + 1}:`);
      console.log('    - race.race_id:', race.race_id);
      console.log('    - race.url_string:', race.url_string);
      console.log('    - race.url_string type:', typeof race.url_string);
      
      // Build URL - check multiple possible formats
      let url = '';
      
      // Try url_string first (might already be full URL or just path)
      if (race.url_string) {
        if (race.url_string.startsWith('http')) {
          // Already a full URL
          url = race.url_string;
          console.log('    ✅ Using url_string as full URL:', url);
        } else if (race.url_string.startsWith('/')) {
          // Path - prepend domain
          url = `https://runsignup.com${race.url_string}`;
          console.log('    ✅ Using url_string as path:', url);
        } else {
          // Relative path without leading slash
          url = `https://runsignup.com/${race.url_string}`;
          console.log('    ✅ Using url_string as relative path:', url);
        }
      } else if (race.race_id) {
        // Fallback to race_id - try different URL formats
        url = `https://runsignup.com/Race/${race.race_id}`;
        console.log('    ⚠️ Built from race_id (may 404):', url);
      } else {
        console.log('    ❌ No URL fields found');
      }

      console.log('    📍 Final URL:', url);

      return {
        race_id: race.race_id,
        name: race.name || 'Untitled Event',
        start_date: race.start_date,
        city: race.city,
        state: race.state,
        debug_url_inputs: {
          race_id: race.race_id,
          url_string: race.url_string,
          url_string_type: typeof race.url_string,
        },
        url: url,
      };
    });

    const responsePayload = {
      success: true,
      events: events,
    };

    console.log('  ✅ Response contract built');
    console.log('    - success:', responsePayload.success);
    console.log('    - events.length:', responsePayload.events.length);
    if (events.length > 0) {
      console.log('    - First event:', {
        race_id: events[0].race_id,
        name: events[0].name,
        url: events[0].url
      });
    }

    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error('\n❌ UNEXPECTED ERROR in pipeline:');
    console.error('  - Error message:', error.message);
    console.error('  - Error stack:', error.stack);
    
    return NextResponse.json({ 
      success: false, 
      events: [],
      error: error.message || 'Unknown error',
      debug: {
        errorType: error.constructor.name,
        errorMessage: error.message
      }
    }, { status: 500 });
  }
}
