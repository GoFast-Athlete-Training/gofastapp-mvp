# RunCrew Front Door / Card Hydration Audit

**Date:** 2025-01-XX  
**Purpose:** Understand current RunCrew front door implementation before refactoring for handles

---

## Executive Summary

**Answer:** ❌ **NO** - We do NOT have a single, generic front door page that properly separates public card view from member container.

**Current State:**
- `/runcrew/[runCrewId]/page.tsx` attempts to be a "dual view" page (violates security rules)
- Membership resolution happens **client-side** (security violation)
- No server-side membership enforcement on container routes
- Join logic is embedded in the container page (wrong pattern)

---

## Question 1: Single Generic Front Door Page?

### Current Implementation: `/app/runcrew/[runCrewId]/page.tsx`

**What it DOES:**
- ✅ Takes URL parameter (`runCrewId`)
- ✅ Resolves RunCrew from database (via API)
- ✅ Hydrates minimal crew metadata (for public view)
- ✅ Renders card-style UI (for unauthenticated users)
- ❌ **BUT:** Also renders full container UI (for authenticated users)
- ❌ **VIOLATION:** Dual view on same route violates security model

**Render States:**
1. **Public View** (lines 339-384): Card + Name + Join Button
   - Triggered when: No Firebase user OR no athleteId
   - Fetches from: `/api/runcrew/public/${runCrewId}`
   - Shows: Minimal metadata only

2. **Authenticated View** (lines 386-544): Full container UI
   - Triggered when: Firebase user exists AND athleteId exists
   - Fetches from: `/api/runcrew/${runCrewId}` (full hydration)
   - Shows: Stats, announcements, runs, navigation buttons

**Problem:** This is a **security violation** - same route shows different content based on client-side auth checks.

---

## Question 2: Hardcoded Routes vs Data-Driven?

### Current Route Structure

**Data-Driven Routes:**
- ✅ `/runcrew/[runCrewId]/page.tsx` - Dynamic (uses ID from URL)
- ✅ `/runcrew/[runCrewId]/member/page.tsx` - Dynamic
- ✅ `/runcrew/[runCrewId]/admin/page.tsx` - Dynamic
- ✅ `/runcrew/[runCrewId]/settings/page.tsx` - Dynamic
- ✅ `/runcrew/[runCrewId]/runs/[runId]/page.tsx` - Dynamic

**No Hardcoded Routes:**
- ✅ No routes like `/your/run/crew-name`
- ✅ All routes are parameterized

**Join Logic Location:**
- ❌ **Embedded in container page** (`/runcrew/[runCrewId]/page.tsx` lines 330-337)
- ❌ **No separate join page** - `/join/runcrew/[encodedId]` does NOT exist yet

---

## Question 3: Membership Resolution

### Where Membership is Checked

#### ❌ Client-Side (WRONG - Security Violation)

**File:** `app/runcrew/[runCrewId]/page.tsx`

**Location:** Lines 180-184
```typescript
// Find current user's membership to check if they're admin
const currentMembership = crewData.membershipsBox?.memberships?.find(
  (m: any) => m.athleteId === athleteId
);
setMembership(currentMembership);
```

**Problem:**
- Membership check happens **after** data is fetched
- Used to decide what UI renders (`isPublicView` state)
- Server returns full crew data regardless of membership
- Client-side logic determines access (security violation)

#### ✅ Server-Side (CORRECT - But Not Used)

**File:** `app/api/runcrew/hydrate/route.ts`

**Location:** Lines 65-72
```typescript
// Verify user is a member of the crew (using box structure)
const isMember = crew.membershipsBox?.memberships?.some(
  (membership: any) => membership.athleteId === athlete.id
);
if (!isMember) {
  return NextResponse.json({ error: 'Forbidden - You are not a member of this crew' }, { status: 403 });
}
```

**Status:** ✅ Membership check exists BUT:
- Only used in `/api/runcrew/hydrate` (POST endpoint)
- **NOT used in `/api/runcrew/[id]` GET endpoint** (line 44 comment says "let it through")

**File:** `app/api/runcrew/[id]/route.ts`

**Location:** Line 44
```typescript
// Just hydrate - welcome page is the gate, let it through
let crew;
try {
  crew = await hydrateCrew(id);
}
```

**Problem:** No membership check - returns full crew data to any authenticated user.

---

## Question 4: Separation of Front Door vs Container?

### Current State: ❌ NO CLEAR SEPARATION

**What EXISTS:**
- ✅ Public API: `/api/runcrew/public/[crewId]` - Returns minimal metadata
- ✅ Domain function: `getCrewPublicMetadata()` - Fetches public fields only
- ❌ **BUT:** No separate front door page - logic is embedded in container page

**What's MISSING:**
- ❌ Separate route for public card view (e.g., `/join/runcrew/[encodedId]`)
- ❌ Clear separation between "front door" and "container"
- ❌ Server-side membership gate on container routes

**Current Flow (WRONG):**
```
/runcrew/[id] 
  → Client checks auth
  → If not auth: Show card (public API)
  → If auth: Show container (full API)
  → Client decides membership (security violation)
```

**Required Flow (CORRECT):**
```
/join/runcrew/[handle] (Front Door)
  → Public API
  → Card UI only
  → Join button → signup → join API

/runcrew/[id] (Container)
  → Server checks membership
  → 403 if not member
  → Full container UI if member
```

---

## Question 5: Can Existing Page Be Adapted for Handles?

### `/app/runcrew/[runCrewId]/page.tsx` Analysis

**Current Parameter:** `runCrewId` (assumed to be database ID)

**Can it use handles?**
- ✅ **Technically yes** - Could resolve handle → ID first
- ❌ **But SHOULD NOT** - This page violates security rules

**Why NOT:**
1. **Dual view violation** - Same route shows public + member views
2. **Client-side access control** - Browser decides what to show
3. **No server-side membership gate** - API doesn't enforce membership
4. **Join logic embedded** - Should be on separate front door page

**Recommendation:** 
- ❌ **DO NOT adapt this page for handles**
- ✅ **Create NEW front door page** at `/join/runcrew/[handle]`
- ✅ **Fix container page** to be member-only with server enforcement

---

## Question 6: Where is Logic Currently Scattered?

### Join + Membership + Display Logic Locations

#### 1. Join Logic
- **Location:** `app/runcrew/[runCrewId]/page.tsx` (lines 330-337)
- **Problem:** Embedded in container page
- **Should be:** Separate `/join/runcrew/[handle]` page

#### 2. Membership Resolution
- **Client-side:** `app/runcrew/[runCrewId]/page.tsx` (lines 180-184)
- **Server-side (partial):** `app/api/runcrew/hydrate/route.ts` (lines 65-72)
- **Missing:** Server-side check in `/api/runcrew/[id]` GET

#### 3. Display Logic
- **Public card:** `app/runcrew/[runCrewId]/page.tsx` (lines 339-384)
- **Container UI:** `app/runcrew/[runCrewId]/page.tsx` (lines 386-544)
- **Problem:** Both on same route, client decides which to show

#### 4. Metadata Hydration
- **Public:** `lib/domain-runcrew.ts::getCrewPublicMetadata()` (line 595)
- **Full:** `lib/domain-runcrew.ts::hydrateCrew()` (line 408)
- **Status:** ✅ Functions exist, but used incorrectly

---

## Current API Endpoints

### Public API (✅ Exists)
- **Route:** `GET /api/runcrew/public/[crewId]`
- **Auth:** None required
- **Returns:** `{ id, name, description, logo, icon, joinCode }`
- **Location:** `app/api/runcrew/public/[crewId]/route.ts`
- **Domain Function:** `getCrewPublicMetadata(crewId)`

### Container API (❌ Missing Membership Check)
- **Route:** `GET /api/runcrew/[id]`
- **Auth:** Required (Firebase token)
- **Returns:** Full crew data with memberships, announcements, runs
- **Location:** `app/api/runcrew/[id]/route.ts`
- **Problem:** No membership verification (line 44 comment: "let it through")
- **Domain Function:** `hydrateCrew(runCrewId)`

### Hydrate API (✅ Has Membership Check)
- **Route:** `POST /api/runcrew/hydrate`
- **Auth:** Required
- **Returns:** Full crew data
- **Location:** `app/api/runcrew/hydrate/route.ts`
- **Status:** ✅ Correctly checks membership (lines 65-72)

---

## Summary: What Needs to Change

### ❌ Current Problems

1. **Dual View on Same Route**
   - `/runcrew/[runCrewId]` shows both public card AND container
   - Violates security model (no dual view allowed)

2. **Client-Side Access Control**
   - Browser decides what to render based on auth state
   - Server doesn't enforce membership on container route

3. **Join Logic Embedded**
   - Join button and logic in container page
   - Should be on separate front door page

4. **No Front Door Page**
   - No dedicated `/join/runcrew/[handle]` route
   - Public viewing happens on container route (wrong)

### ✅ What Exists (Can Be Reused)

1. **Public API Endpoint** - `/api/runcrew/public/[crewId]`
2. **Public Metadata Function** - `getCrewPublicMetadata()`
3. **Full Hydration Function** - `hydrateCrew()`
4. **Data-Driven Routes** - All routes use parameters (not hardcoded)

### 🔧 Required Changes

1. **Create Front Door Page**
   - Route: `/join/runcrew/[handle]`
   - Resolve handle → runCrewId
   - Fetch public metadata
   - Render card UI only
   - Join button → signup flow

2. **Fix Container Page**
   - Route: `/runcrew/[id]` (member-only)
   - Remove all public view logic
   - Remove join logic
   - Server enforces membership (403 if not member)

3. **Add Membership Check to Container API**
   - `GET /api/runcrew/[id]` must verify membership
   - Return 403 if not member
   - Remove comment "let it through"

4. **Update Success Page**
   - Generate front door URL: `/join/runcrew/join-${crewId}`
   - Not container URL: `/runcrew/${crewId}`

---

## Handle Adaptation Feasibility

### Can Current Page Use Handles?

**Technical Answer:** Yes, but **SHOULD NOT**

**Why:**
- Current page has security violations
- Dual view pattern is wrong
- Client-side access control is wrong

**Correct Approach:**
1. Create NEW front door page for handles
2. Fix container page to be member-only
3. Resolve handle → ID in front door page
4. Keep container page using IDs (internal)

---

## Files Identified

### Front Door / Card Logic (Currently Wrong)
- `app/runcrew/[runCrewId]/page.tsx` - Lines 59-161 (public fetch), 339-384 (public UI)

### Container Logic
- `app/runcrew/[runCrewId]/page.tsx` - Lines 163-228 (auth fetch), 386-544 (container UI)
- `app/runcrew/[runCrewId]/member/page.tsx` - Full member view
- `app/runcrew/[runCrewId]/admin/page.tsx` - Admin view
- `app/runcrew/[runCrewId]/settings/page.tsx` - Settings view

### API Endpoints
- `app/api/runcrew/public/[crewId]/route.ts` - ✅ Public metadata
- `app/api/runcrew/[id]/route.ts` - ❌ Missing membership check
- `app/api/runcrew/hydrate/route.ts` - ✅ Has membership check

### Domain Functions
- `lib/domain-runcrew.ts::getCrewPublicMetadata()` - ✅ Public metadata
- `lib/domain-runcrew.ts::hydrateCrew()` - ✅ Full hydration
- `lib/domain-runcrew.ts::getCrewById()` - ✅ Basic crew lookup

---

## Conclusion

**Answer to Main Question:** ❌ **NO** - We do NOT have a proper single generic front door page.

**What We Have:**
- A container page that tries to be both front door and container (wrong)
- Client-side access control (security violation)
- Join logic embedded in container page (wrong pattern)

**What We Need:**
- Separate front door page: `/join/runcrew/[handle]`
- Member-only container page: `/runcrew/[id]` with server enforcement
- Clear separation of concerns
- Server-side membership gates

**Can Current Page Be Adapted?**
- Technically yes, but **SHOULD NOT** - violates security rules
- Better to create new front door page and fix container page

