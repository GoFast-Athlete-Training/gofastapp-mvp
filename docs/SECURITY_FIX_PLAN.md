# Security Fix Plan - RunCrew Container Access

**Issue:** Current implementation violates security model by allowing dual view on `/runcrew/[id]`

**Required Fix:**
1. Add membership check to `/api/runcrew/[id]` GET endpoint (server-side)
2. Remove public view logic from `/runcrew/[id]` page (member-only)
3. Create NEW public route `/join/runcrew/[encodedId]` for public viewing
4. Use URL generator that transforms `runCrewId` slightly (preserves unique ID logic)

---

## URL Transformation Strategy

**Public Route:** `/join/runcrew/[encodedId]`
- Takes actual `runCrewId`
- Adds prefix `join-` or similar transformation
- Decodes back to `runCrewId` for lookup
- Preserves unique ID logic without slugs

**Example:**
- Container ID: `cmk4nxh0c0001lb04dmyed0qy`
- Public URL: `/join/runcrew/join-cmk4nxh0c0001lb04dmyed0qy`
- Decode: Remove `join-` prefix to get actual ID

---

## Files to Fix

### 1. `/app/api/runcrew/[id]/route.ts`
**Current:** No membership check - just verifies auth
**Fix:** Add membership verification before returning data
**Status:** ❌ NEEDS FIX

```typescript
// After hydrateCrew(id), check membership
const isMember = crew.membershipsBox?.memberships?.some(
  (m: any) => m.athleteId === athlete.id
);
if (!isMember) {
  return NextResponse.json({ error: 'Forbidden - Membership required' }, { status: 403 });
}
```

### 2. `/app/runcrew/[runCrewId]/page.tsx`
**Current:** Shows dual view (public or authenticated) on same route
**Fix:** Remove all public view logic - page is MEMBER-ONLY
**Status:** ❌ NEEDS FIX

**Remove:**
- `isPublicView` state
- Public view conditional rendering (lines 339-384)
- Public API fetch logic (lines 59-161)
- All client-side access control

**Keep:**
- Authenticated member view only
- Server will enforce membership (403 if not member)

### 3. Create `/app/join/runcrew/[encodedId]/page.tsx` (NEW)
**Purpose:** Public view for joining - card + name + join button
**Status:** ❌ NEEDS CREATION

**Features:**
- No authentication required
- Decode `encodedId` to get actual `runCrewId` (remove `join-` prefix)
- Fetches crew metadata by `runCrewId` via public API
- Shows: Card + Name + Join Button
- Stores actual `runCrewId` as `pendingCrewId` on join click
- Redirects to `/signup`

### 4. Create URL Generator Helper (NEW)
**Location:** `lib/domain-runcrew.ts`
**Status:** ❌ NEEDS CREATION

```typescript
/**
 * Generate public join URL from runCrewId
 * Adds 'join-' prefix to preserve unique ID logic
 */
export function generatePublicJoinUrl(runCrewId: string): string {
  return `/join/runcrew/join-${runCrewId}`;
}

/**
 * Decode public join URL to get actual runCrewId
 * Removes 'join-' prefix
 */
export function decodePublicJoinUrl(encodedId: string): string | null {
  if (!encodedId.startsWith('join-')) {
    return null;
  }
  return encodedId.replace('join-', '');
}
```

### 5. Update `/app/api/runcrew/public/[crewId]/route.ts`
**Current:** Uses `crewId` directly
**Status:** ✅ Already exists - keep as is
**Note:** This can accept decoded `runCrewId`

### 6. `/app/runcrew/success/page.tsx`
**Current:** Generates `/runcrew/${crewId}` URL
**Fix:** Generate `/join/runcrew/join-${crewId}` URL using helper
**Status:** ❌ NEEDS FIX

---

## Implementation Steps

1. ✅ Add membership check to `/api/runcrew/[id]` GET
2. ✅ Remove public view from `/runcrew/[id]` page  
3. ✅ Create URL generator/decoder helpers
4. ✅ Create `/join/runcrew/[encodedId]` page
5. ✅ Update success page to use public join URL generator
6. ✅ Test: Unauthenticated users cannot access `/runcrew/[id]`
7. ✅ Test: Public view works at `/join/runcrew/join-[id]`

---

## Security Rules Enforced

✅ **Auth ≠ Access** - Authentication alone is not enough
✅ **Membership is the gate** - Server verifies membership
✅ **No container IDs in public URLs** - Uses encoded ID with prefix
✅ **No dual view** - Separate routes for public vs member
✅ **Server-side enforcement** - Browser cannot decide access
✅ **Preserves unique ID logic** - No slug management needed
