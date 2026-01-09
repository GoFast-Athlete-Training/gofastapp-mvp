# Discovery Page vs Invite Flow - Analysis

**Date:** January 2025  
**Goal:** Understand both flows and how to combine them

---

## 1. What is the Current Discovery Page Doing?

### Route: `/runcrew`

**Purpose:** Browse and discover RunCrews (authenticated users only)

**Flow:**
```
User visits /runcrew
  ↓
Uses api.get() → automatically adds Bearer token (requires auth)
  ↓
Fetches /api/runcrew/discover (API says public, but client requires auth)
  ↓
Shows grid of RunCrew cards
  ↓
User clicks card → Links to /runcrew/${crew.id} (member container page)
  ↓
CTA: "View Details" (not a join action)
```

**Key Characteristics:**
- ✅ **Requires Authentication** - Uses `api.get()` which adds Bearer token
- ✅ **Has TopNav** - Shows profile, sign out (requires auth)
- ✅ **Links to Member Pages** - `/runcrew/${crew.id}` (internal ID, member-only)
- ✅ **No Join Action** - Just "View Details" button
- ✅ **Uses Internal IDs** - Not public handles/slugs
- ✅ **Full Filtering** - Search, location, purpose, race training filters

**API Calls:**
- `api.get('/runcrew/discover')` - Gets list of crews (requires auth via interceptor)
- `api.get('/runcrew/locations')` - Gets location filter data (requires auth)
- `api.post('/race/search')` - Race search for filters (requires auth)

**Problem:** Cannot be used on public website - requires authentication

---

## 2. What is the RunCrew Invite Flow Doing?

### Route: `/join/runcrew/[handle]`

**Purpose:** Public landing page for a specific RunCrew (by handle/slug)

**Flow:**
```
User visits /join/runcrew/boston-runners
  ↓
Uses fetch() directly → NO auth token (public access)
  ↓
Fetches /api/runcrew/public/handle/[handle] (truly public endpoint)
  ↓
Shows single RunCrew card with details
  ↓
User clicks "Join this Crew"
  ↓
┌─────────────────────┬─────────────────────┐
│ NOT AUTHENTICATED   │ AUTHENTICATED        │
└─────────────────────┴─────────────────────┘
         ↓                        ↓
/join/runcrew/[handle]/signup   Show confirmation UI
         ↓                        ↓
Signup flow → returns to front door → Join API call
```

**Key Characteristics:**
- ✅ **Public Access** - Uses `fetch()` directly, no auth required
- ✅ **Public URL by Handle** - `/join/runcrew/boston-runners` (slug-based)
- ✅ **Single Crew View** - Shows one crew's details
- ✅ **Join Action** - "Join this Crew" CTA
- ✅ **Handles Both States** - Works for authenticated and unauthenticated
- ✅ **Join Intent Flow** - Stores intent in localStorage, handles signup redirect

**Join Intent Flow (Detailed):**
1. User clicks "Join this Crew"
2. If not authenticated → `/join/runcrew/[handle]/signup` (explainer page)
3. User signs up → stores `runCrewJoinIntent` and `runCrewJoinIntentHandle` in localStorage
4. After signup → redirects back to `/join/runcrew/[handle]`
5. Front door detects join intent → shows confirmation UI
6. User confirms → calls `/api/runcrew/join` → creates membership
7. Redirects to `/runcrew/${id}/join-success`

**API Calls:**
- `fetch('/api/runcrew/public/handle/[handle]')` - Public, no auth
- `api.post('/runcrew/join')` - Requires auth (only called after signup)

---

## 3. How Do We Do Both?

### Goal: Public discovery page that links to invite flow

**Solution:** Create public discovery page that combines both patterns

### Approach: Hybrid Pattern

```
Public Discovery Page (/groups or /discover)
  ↓
Uses fetch() → NO auth required (public)
  ↓
Fetches /api/runcrew/discover (API is already public, just need to use fetch)
  ↓
Shows grid of RunCrew cards (same UI as current discovery)
  ↓
User clicks card → Links to /join/runcrew/${crew.handle} (public invite flow)
  ↓
CTA: "Join this Crew" (same as invite flow)
```

### Implementation Plan

#### Step 1: Update API to Return Handles
- ✅ Add `handle` field to `getDiscoverableRunCrews()` response
- ✅ Update `/api/runcrew/discover` to include handle in response

#### Step 2: Create Public Discovery Page
**Route Options:**
- `/groups` - Simple, clear
- `/discover` - More descriptive
- `/runcrews` - Plural form

**Key Changes from Current Page:**
1. **Use `fetch()` instead of `api.get()`**
   ```typescript
   // OLD (requires auth):
   const response = await api.get(`/runcrew/discover?${params}`);
   
   // NEW (public):
   const response = await fetch(`/api/runcrew/discover?${params}`);
   const data = await response.json();
   ```

2. **Remove TopNav or Make Conditional**
   - Option A: Remove entirely (cleaner for public)
   - Option B: Show minimal header with logo only
   - Option C: Show TopNav only if authenticated

3. **Update Links to Use Handles**
   ```typescript
   // OLD (member-only):
   href={`/runcrew/${crew.id}`}
   
   // NEW (public invite flow):
   href={`/join/runcrew/${crew.handle}`}
   ```

4. **Change CTA Text**
   ```typescript
   // OLD:
   "View Details"
   
   // NEW:
   "Join this Crew"
   ```

5. **Handle Location API**
   - Check if `/api/runcrew/locations` is public (it appears to be)
   - Use `fetch()` instead of `api.get()`

6. **Handle Race Search**
   - Check if `/api/race/search` is public
   - If not, may need to make it public or remove race filter

#### Step 3: Keep Existing Page (Optional)
- Keep `/runcrew` for authenticated users (internal discovery)
- OR redirect authenticated users to public page
- OR merge into one page that works for both

---

## Comparison Table

| Feature | Current Discovery (`/runcrew`) | Invite Flow (`/join/runcrew/[handle]`) | Public Discovery (Proposed) |
|---------|-------------------------------|----------------------------------------|----------------------------|
| **Route** | `/runcrew` | `/join/runcrew/[handle]` | `/groups` or `/discover` |
| **Auth Required** | ✅ Yes | ❌ No | ❌ No |
| **API Method** | `api.get()` (adds token) | `fetch()` (no token) | `fetch()` (no token) |
| **Navigation** | TopNav (auth required) | None (public) | Minimal or none |
| **URL Format** | Internal IDs | Handles/slugs | Handles/slugs |
| **Link Target** | `/runcrew/${id}` (member) | `/join/runcrew/${handle}` (public) | `/join/runcrew/${handle}` (public) |
| **CTA** | "View Details" | "Join this Crew" | "Join this Crew" |
| **View Type** | Grid of multiple crews | Single crew card | Grid of multiple crews |
| **Filtering** | ✅ Full filters | ❌ None | ✅ Full filters |
| **Join Flow** | ❌ No | ✅ Yes | ✅ Yes (via link) |

---

## Implementation Checklist

### Phase 1: API Updates
- [x] Add `handle` to `getDiscoverableRunCrews()` select
- [x] Add `handle` to `getDiscoverableRunCrews()` return
- [ ] Verify `/api/runcrew/locations` is public (or make it public)
- [ ] Verify `/api/race/search` is public (or make it public, or remove filter)

### Phase 2: Public Discovery Page
- [ ] Create new page at `/groups` (or chosen route)
- [ ] Replace `api.get()` with `fetch()` for discover endpoint
- [ ] Replace `api.get()` with `fetch()` for locations endpoint
- [ ] Update card links to use handles: `/join/runcrew/${crew.handle}`
- [ ] Change CTA to "Join this Crew"
- [ ] Remove or conditionally render TopNav
- [ ] Test with unauthenticated users

### Phase 3: Testing
- [ ] Test public access (no auth)
- [ ] Test authenticated access
- [ ] Test join flow from discovery page
- [ ] Test filters work without auth
- [ ] Verify links work correctly

---

## Code Examples

### Current Discovery (Authenticated)
```typescript
// Requires auth
const response = await api.get(`/runcrew/discover?${params}`);
const crews = response.data.runCrews;

// Links to member page
<Link href={`/runcrew/${crew.id}`}>
  <button>View Details</button>
</Link>
```

### Invite Flow (Public)
```typescript
// Public, no auth
const response = await fetch(`/api/runcrew/public/handle/${handle}`);
const data = await response.json();
const crew = data.runCrew;

// Join action
<button onClick={handleJoinClick}>Join this Crew</button>
```

### Public Discovery (Proposed)
```typescript
// Public, no auth
const response = await fetch(`/api/runcrew/discover?${params}`);
const data = await response.json();
const crews = data.runCrews;

// Links to public invite flow
<Link href={`/join/runcrew/${crew.handle}`}>
  <button>Join this Crew</button>
</Link>
```

---

## Questions to Resolve

1. **Route Name:** `/groups`, `/discover`, or `/runcrews`?
2. **TopNav:** Remove entirely or show minimal version?
3. **Location API:** Is it public? Need to verify.
4. **Race Search:** Is it public? If not, remove filter or make public.
5. **Existing Page:** Keep `/runcrew` for authenticated users or merge?

---

## Next Steps

1. ✅ Analysis complete (this document)
2. ⏳ Decide on route name and approach
3. ⏳ Update API to return handles (already started)
4. ⏳ Create public discovery page
5. ⏳ Test and verify

