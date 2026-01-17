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

    // Build URL with only required params
    const url = new URL('https://api.runsignup.com/rest/races');
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('api_secret', apiSecret);
    url.searchParams.append('format', 'json');
    url.searchParams.append('page', '1');
    url.searchParams.append('results_per_page', '5');

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

    // ============================================================
    // STAGE 4: PUSH TO CLIENT (Response Contract)
    // ============================================================
    console.log('\n📥 STAGE 4: PUSH TO CLIENT');
    console.log('  - Building response contract...');

    // MVP1: Return raw races array (no normalization yet)
    const responsePayload = {
      success: true,
      events: data.races, // Raw races from RunSignUp
    };

    console.log('  ✅ Response contract built');
    console.log('    - success:', responsePayload.success);
    console.log('    - events.length:', responsePayload.events.length);
    console.log('    - First event keys:', responsePayload.events[0] ? Object.keys(responsePayload.events[0]) : 'no events');

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
