# Race Events Implementation Analysis

**Date:** January 2025  
**Purpose:** Document the RunSignUp API integration for Race Events directory  
**Status:** 🔴 Debugging - API may not be returning data correctly

---

## Overview

The Race Events feature surfaces upcoming races from RunSignUp API. This is a **server-side handoff** where:
- Client calls `/api/race-events` (our internal API)
- Server fetches from RunSignUp API with credentials
- Returns normalized race data to client
- **NO FALLBACKS** - we need to see what RunSignUp actually returns

---

## Current Implementation

### API Route: `/app/api/race-events/route.ts`

**Endpoint:** `GET /api/race-events`  
**Server-side only** - credentials never exposed to client

**Request to RunSignUp:**
```
GET https://runsignup.com/rest/races
Query Parameters:
  - api_key: {RUNSIGNUP_API_KEY}
  - api_secret: {RUNSIGNUP_API_SECRET}
  - format: json
  - start_date: today
  - results_per_page: 5
  - race_links: T
```

**Expected Response Structure:**
```json
{
  "races": [
    {
      "race_id": "12345",
      "name": "Race Name",
      "start_date": "2025-02-15",
      "city": "Boston",
      "state": "MA",
      "url_string": "/Race/12345",
      "events": [
        {
          "event_type": "5K",
          "distance": "3.1",
          "distance_units": "miles"
        }
      ]
    }
  ]
}
```

**Normalization Logic:**
```typescript
{
  id: race.race_id || race.id,
  name: race.name || 'Untitled Event',
  startDate: race.start_date || race.event_date || '',
  location: `${city}, ${state}` || 'Location TBD',
  url: race.race_url || `https://runsignup.com${race.url_string}` || `https://runsignup.com/Race/${raceId}`,
  raceType: firstEvent.event_type || '',
  miles: convertedDistance || null
}
```

---

## Current Page: `/app/race-events/page.tsx`

**Route:** `/race-events`  
**Client Component** - fetches from our internal API

**Flow:**
1. Page loads → calls `api.get('/race-events')`
2. If success → displays events list
3. If error → shows error message (NO FALLBACK)
4. If empty → shows "No upcoming races found"

**UI States:**
- ✅ Loading: Spinner with "Loading events..."
- ❌ Error: Red error banner
- 📭 Empty: "No upcoming races found" message (RunSignUp only)
- ✅ Success: List of clickable race cards

---

## Environment Variables Required

**Server-side only (never exposed to client):**
```bash
RUNSIGNUP_API_KEY=your_api_key_here
RUNSIGNUP_API_SECRET=your_api_secret_here
```

**Location:** Set in deployment environment (Vercel, etc.)

---

## Potential Issues

### 1. API Endpoint URL
**Current:** `https://runsignup.com/rest/races`  
**Check:** Should it be `https://api.runsignup.com/rest/races`?

### 2. Authentication Method
**Current:** Query parameters (`api_key`, `api_secret`)  
**Alternative:** OAuth 2.0 or different auth method?

### 3. Response Format
**Current:** Expecting `data.races` array  
**Reality:** Response structure might be different

### 4. Date Filtering
**Current:** `start_date=today`  
**Check:** Does RunSignUp API support "today" or need ISO date?

### 5. Empty Response
**Possible causes:**
- No races matching criteria
- API returning empty array
- Authentication failing (silently)
- Wrong endpoint/parameters

---

## Debugging Checklist

### Server-Side (API Route)

1. **Check environment variables:**
   ```bash
   # In production/vercel:
   RUNSIGNUP_API_KEY=?
   RUNSIGNUP_API_SECRET=?
   ```

2. **Check API response:**
   - Add logging in `/app/api/race-events/route.ts`
   - Log: `url.toString()`, `response.status`, `response.json()`

3. **Test API call manually:**
   ```bash
   curl "https://runsignup.com/rest/races?api_key=KEY&api_secret=SECRET&format=json&start_date=today&results_per_page=5"
   ```

4. **Check response structure:**
   - Does it return `{ races: [...] }`?
   - Or `{ race: [...] }`?
   - Or different structure?

### Client-Side (Page)

1. **Check browser console:**
   - Network tab → `/api/race-events` request
   - Response status code
   - Response body structure

2. **Check error messages:**
   - What error is displayed?
   - What does console.error show?

---

## Current Code (No Fallbacks)

### API Route: `/app/api/race-events/route.ts`
```typescript
export async function GET() {
  try {
    const apiKey = process.env.RUNSIGNUP_API_KEY;
    const apiSecret = process.env.RUNSIGNUP_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('❌ RunSignUp credentials missing');
      return NextResponse.json({ success: false, events: [] });
    }

    const url = new URL('https://runsignup.com/rest/races');
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('api_secret', apiSecret);
    url.searchParams.append('format', 'json');
    url.searchParams.append('start_date', 'today');
    url.searchParams.append('results_per_page', '5');
    url.searchParams.append('race_links', 'T');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('❌ RunSignUp API error:', response.status, response.statusText);
      return NextResponse.json({ success: false, events: [] });
    }

    const data = await response.json();
    const races = data.races || [];

    // Normalize and return
    const normalizedEvents = races.slice(0, 5).map((race: any) => {
      // ... normalization logic
    });

    return NextResponse.json({ success: true, events: normalizedEvents });
  } catch (error: any) {
    console.error('❌ Error fetching from RunSignUp:', error);
    return NextResponse.json({ success: false, events: [] });
  }
}
```

### Page: `/app/race-events/page.tsx`
```typescript
useEffect(() => {
  async function loadEvents() {
    try {
      setLoading(true);
      setError(null);

      // Fetch race events from RunSignUp API (server-side handoff)
      const response = await api.get('/race-events');
      
      if (response.data?.success && response.data?.events) {
        setEvents(response.data.events);
      } else {
        setEvents([]);
      }
    } catch (err: any) {
      console.error('Error loading events:', err);
      setError('Could not load events at this time.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }
  loadEvents();
}, []);
```

---

## RunSignUp API Documentation

**Official Docs:** https://runsignup.com/Api/races/GET

**Key Points:**
- Public races available without director account
- Authentication via `api_key` and `api_secret` query params
- Returns JSON with race data
- Supports filtering by date, location, etc.

**Sample Response Structure (from docs):**
```json
{
  "races": [
    {
      "race_id": 12345,
      "name": "Race Name",
      "start_date": "2025-02-15",
      "city": "Boston",
      "state": "MA",
      "url_string": "/Race/12345",
      "events": [...]
    }
  ]
}
```

---

## Next Steps

1. **Add detailed logging** to API route to see:
   - Exact URL being called
   - Response status code
   - Full response body
   - Parsed data structure

2. **Test API manually** with curl to verify:
   - Endpoint URL is correct
   - Authentication works
   - Response structure matches expectations

3. **Check deployment environment** to ensure:
   - Environment variables are set
   - Variables are accessible at runtime

4. **Verify API credentials** with RunSignUp:
   - API key is valid
   - API secret is correct
   - Account has access to race data

---

## Error Scenarios

| Scenario | Response | What We See |
|----------|----------|-------------|
| Credentials missing | `{ success: false, events: [] }` | Empty state |
| API returns 401/403 | `{ success: false, events: [] }` | Empty state |
| API returns 500 | `{ success: false, events: [] }` | Empty state |
| No races found | `{ success: true, events: [] }` | Empty state |
| Network error | `{ success: false, events: [] }` | Error message |
| Invalid response format | `{ success: true, events: [] }` | Empty state |

**Problem:** All error scenarios result in empty state - we need logging to differentiate!

---

## Recommended Changes

1. **Add structured logging:**
   ```typescript
   console.log('🔍 RACE EVENTS API CALL:', {
     url: url.toString(),
     hasCredentials: !!apiKey && !!apiSecret,
   });
   
   console.log('📦 RACE EVENTS RESPONSE:', {
     status: response.status,
     statusText: response.statusText,
     data: data, // Full response
   });
   ```

2. **Return error details (for debugging):**
   ```typescript
   return NextResponse.json({
     success: false,
     events: [],
     error: error.message,
     debug: { status: response?.status }
   });
   ```

3. **Check response structure:**
   ```typescript
   console.log('📊 RESPONSE STRUCTURE:', {
     hasRaces: !!data.races,
     racesCount: data.races?.length,
     keys: Object.keys(data),
   });
   ```

---

## Testing Checklist

- [ ] Environment variables set in deployment
- [ ] API endpoint URL is correct
- [ ] Authentication parameters correct
- [ ] Response structure matches expectations
- [ ] Empty state displays correctly
- [ ] Error handling works
- [ ] Race cards render when data exists
- [ ] Click opens RunSignUp registration page

---

**Last Updated:** January 2025  
**Status:** 🔴 Needs debugging - no races showing

