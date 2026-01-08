# Public RunCrew Viewing Implementation Summary

**Date:** 2025-01-XX  
**Status:** ✅ Implemented  
**Route:** `/runcrew/[runCrewId]`

---

## What Was Built

### Single Route, Two Different Views

The **same URL** (`/runcrew/[runCrewId]`) now shows **different content** based on authentication status:

---

## 1. Regular RunCrew Page (Authenticated Users)

**When:** User is logged in AND has `athleteId` in localStorage

**What Shows:**
- Full header with crew logo/icon and name
- Welcome section
- "View as Member" and "View as Admin" buttons
- Stats grid (Members count, Announcements count, Upcoming Runs count)
- Recent Announcements preview
- Upcoming Runs preview
- All crew data (memberships, announcements, runs)

**API Used:** `GET /api/runcrew/[id]` (requires authentication)

**Location in Code:** Lines 386-544 in `app/runcrew/[runCrewId]/page.tsx`

---

## 2. Public RunCrew Page (Unauthenticated Users)

**When:** User is NOT logged in OR missing `athleteId`

**What Shows:**
- **Crew Card** (logo or icon)
- **Crew Name**
- **Join Button**

**That's it.** Nothing else.

**API Used:** `GET /api/runcrew/public/[crewId]` (no authentication required)

**Location in Code:** Lines 339-384 in `app/runcrew/[runCrewId]/page.tsx`

---

## How It Works

### Detection Logic

```typescript
// Check Firebase auth state
onAuthStateChanged(auth, async (firebaseUser) => {
  if (!firebaseUser) {
    // NO USER → Show public view
    setIsPublicView(true);
    // Fetch from public API
    const response = await fetch(`/api/runcrew/public/${runCrewId}`);
  } else {
    // HAS USER → Check for athleteId
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      // No athleteId → Show public view
      setIsPublicView(true);
      // Fetch from public API
    } else {
      // Fully authenticated → Show full page
      setIsPublicView(false);
      // Fetch from authenticated API
      const response = await api.get(`/runcrew/${runCrewId}`);
    }
  }
});
```

### Conditional Rendering

```typescript
// Public view UI (not authenticated) - Simple: Name, Card, Join Button
if (isPublicView) {
  return (
    // Minimal view: Card + Name + Join Button
  );
}

// Authenticated view UI
return (
  // Full page with stats, announcements, runs, etc.
);
```

---

## What Happens When User Clicks "Join"

1. **Store crewId** in localStorage as `pendingCrewId`
2. **Redirect** to `/signup`
3. **After signup/login:**
   - `handlePendingCrewJoin()` checks for `pendingCrewId`
   - Calls `POST /api/runcrew/join` with `{ crewId: pendingCrewId }`
   - Creates membership
   - Redirects to `/runcrew/[id]` (now shows full authenticated view)

---

## API Endpoints

### Public API (New)
- **Route:** `GET /api/runcrew/public/[crewId]`
- **Auth:** None required
- **Returns:** `{ id, name, description, logo, icon, joinCode }`
- **Location:** `app/api/runcrew/public/[crewId]/route.ts`

### Join API (New)
- **Route:** `POST /api/runcrew/join`
- **Auth:** Required (Firebase token)
- **Body:** `{ crewId: string }`
- **Returns:** `{ success: true, runCrew: {...} }`
- **Location:** `app/api/runcrew/join/route.ts`

### Authenticated API (Existing)
- **Route:** `GET /api/runcrew/[id]`
- **Auth:** Required (Firebase token)
- **Returns:** Full crew data with memberships, announcements, runs, etc.
- **Location:** `app/api/runcrew/[id]/route.ts`

---

## Files Changed

1. **`app/runcrew/[runCrewId]/page.tsx`**
   - Added public view logic (lines 59-161)
   - Added conditional rendering (lines 339-384 for public, 386-544 for authenticated)

2. **`app/api/runcrew/join/route.ts`** (NEW FILE)
   - Created join endpoint that accepts `crewId`

3. **`app/signup/page.tsx`**
   - Added `handlePendingCrewJoin()` function
   - Integrated into all signup/login flows (Google, email signup, email signin)

---

## Example URLs

Both URLs are the **same route** but show different content:

- **Unauthenticated:** `https://pr.gofastcrushgoals.com/runcrew/cmk4nxh0c0001lb04dmyed0qy`
  - Shows: Card + Name + Join Button

- **Authenticated:** `https://pr.gofastcrushgoals.com/runcrew/cmk4nxh0c0001lb04dmyed0qy`
  - Shows: Full page with stats, announcements, runs, etc.

---

## Testing

### Test Public View
1. Open incognito/private window
2. Visit: `https://pr.gofastcrushgoals.com/runcrew/[any-crew-id]`
3. Should see: Card + Name + Join Button only

### Test Join Flow
1. Click "Join" on public view
2. Should redirect to `/signup`
3. Sign up or sign in
4. Should automatically join crew and redirect to `/runcrew/[id]`
5. Should now see full authenticated view

---

## Summary

✅ **Same URL, two views:**
- Not logged in → Simple card + name + join button
- Logged in → Full page with all features

✅ **Public API endpoint** for fetching crew metadata without auth

✅ **Join API endpoint** for joining by `crewId`

✅ **Auto-join flow** after signup/login via `pendingCrewId` localStorage

