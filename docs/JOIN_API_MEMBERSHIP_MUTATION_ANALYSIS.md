# Join API Membership Mutation Analysis

**Date:** 2025-01-XX  
**Purpose:** Investigate how the join API mutates to membership and understand the current join flow

---

## How Join API Creates Membership

### Current Implementation

**Location:** `lib/domain-runcrew.ts::joinCrewById()` and `joinCrew()`

```typescript
export async function joinCrewById(runCrewId: string, athleteId: string) {
  // Step 1: Find crew by ID
  const crew = await prisma.run_crews.findUnique({
    where: { id: runCrewId },
  });

  if (!crew) {
    throw new Error('Crew not found');
  }

  // Step 2: Check if already a member (idempotent)
  const existingMembership = await prisma.run_crew_memberships.findUnique({
    where: {
      runCrewId_athleteId: {
        runCrewId: crew.id,
        athleteId,
      },
    },
  });

  if (existingMembership) {
    return crew; // Already a member, return crew (no error)
  }

  // Step 3: Create membership record with 'member' role
  await prisma.run_crew_memberships.create({
    data: {
      runCrewId: crew.id,
      athleteId,
      role: 'member', // ✅ Role is set at creation
    },
  });

  return crew;
}
```

### Database Mutation

**Table:** `run_crew_memberships`

**What Gets Created:**
```sql
INSERT INTO run_crew_memberships (
  id,              -- Auto-generated CUID
  runCrewId,       -- The crew being joined
  athleteId,       -- The athlete joining
  role,            -- 'member' (default role)
  joinedAt,        -- Auto-set to now()
  createdAt,       -- Auto-set to now()
  updatedAt        -- Auto-set to now()
)
```

**Unique Constraint:** `[runCrewId, athleteId]` prevents duplicate memberships

---

## Current Join Flow Options

### Option A: Already Authenticated User

**Scenario:** User is logged in and clicks "Join the Crew" button

**Current Flow (BEFORE removal):**
1. User clicks "Join" button on `/join/crew/[crewId]` page
2. Page checks if user is authenticated
3. If authenticated → calls `POST /api/runcrew/join` with `{ crewId }`
4. API route:
   - Verifies Firebase token
   - Gets athlete by Firebase ID
   - Calls `joinCrewById(crewId, athlete.id)`
   - Creates membership record
5. Redirects to `/runcrew/[id]`

**After API Route Removal:**
- ❌ **No current implementation** - join page was deleted
- Need to implement direct call to `joinCrewById()` from UI
- Or create new join page that calls domain function directly

---

### Option B: Unauthenticated User (Temp Storage System)

**Scenario:** User gets invite link, not logged in yet

**Previous Flow (BEFORE removal):**
1. User visits `/join/crew/[crewId]` (public page)
2. Page stores `crewId` in localStorage as `pendingCrewId`
3. User clicks "Join" → redirected to `/signup`
4. After signup/login completes:
   - `handlePendingCrewJoin()` checks for `pendingCrewId`
   - Calls `POST /api/runcrew/join` with `{ crewId: pendingCrewId }`
   - Creates membership
   - Clears `pendingCrewId` from localStorage
   - Redirects to `/runcrew/[id]`

**Current State:**
- ❌ `handlePendingCrewJoin()` was removed from signup page
- ❌ Join page was deleted
- ⚠️ **Temp storage system is broken** - no way to handle pending joins

**Fragility Issues:**
- localStorage can be cleared
- No server-side session tracking
- If user closes browser before signup, join is lost
- No expiration mechanism

---

## API Route Analysis

**Location:** `app/api/runcrew/join/route.ts`

**What It Does:**
1. ✅ Verifies Firebase authentication token
2. ✅ Gets athlete by Firebase ID
3. ✅ Supports both `joinCode` (legacy) and `crewId` (new flow)
4. ✅ Calls domain function `joinCrewById()` or `joinCrew()`
5. ✅ Returns success with crew data

**Why It Exists:**
- Provides authenticated endpoint for joining
- Handles Firebase token verification
- Maps Firebase user to athlete record
- Provides error handling and status codes

**If Removed:**
- UI would need to:
  - Handle Firebase auth directly
  - Call domain functions directly (but they're server-side only)
  - Or create new API route with different pattern

---

## Membership Mutation Details

### What Happens When User Joins

1. **Check Existing Membership**
   ```typescript
   const existingMembership = await prisma.run_crew_memberships.findUnique({
     where: { runCrewId_athleteId: { runCrewId, athleteId } }
   });
   ```
   - Uses unique constraint to check
   - If exists → returns crew (idempotent, no error)

2. **Create Membership Record**
   ```typescript
   await prisma.run_crew_memberships.create({
     data: {
       runCrewId: crew.id,
       athleteId,
       role: 'member', // ✅ Role is explicitly set
     }
   });
   ```
   - Creates new record in `run_crew_memberships` table
   - Sets `role: 'member'` (not admin/manager)
   - Auto-sets `joinedAt`, `createdAt`, `updatedAt`

3. **No Manager Record Created**
   - Regular members don't get `run_crew_managers` record
   - Only admins/managers get manager records
   - Role is stored in membership table (if schema supports it)

---

## Current Schema State

**From Analysis Docs:**
- ✅ `run_crew_memberships` table has `role` field (added in refactor)
- ✅ Role is set to `'member'` when joining
- ✅ No separate manager record needed for regular members
- ✅ Unique constraint prevents duplicates

---

## Recommendations

### If Removing API Route:

1. **Option 1: Direct Server Action**
   - Create Next.js server action that calls `joinCrewById()`
   - UI calls server action instead of API route
   - Still handles auth via server-side session

2. **Option 2: New Join Page**
   - Recreate `/join/crew/[crewId]` page
   - Page calls domain function via server action
   - Handles both authenticated and unauthenticated flows

3. **Option 3: Inline Join on Crew Page**
   - Add "Join" button directly on `/runcrew/[id]` page
   - If not member → show join button
   - Calls server action to join
   - No separate join page needed

### For Temp Storage System:

1. **Keep localStorage approach** (simple, works)
   - Store `pendingCrewId` in localStorage
   - Check after signup/login
   - Call join function

2. **Add expiration** (improve robustness)
   - Store timestamp with `pendingCrewId`
   - Expire after 24 hours
   - Clear on page load if expired

3. **Server-side session** (more robust)
   - Store pending join in database
   - Link to Firebase ID or email
   - Auto-join after signup
   - More complex but more reliable

---

## Questions to Answer

1. **How should authenticated users join?**
   - Direct button on crew page?
   - Separate join page?
   - Server action or API route?

2. **How should unauthenticated users join?**
   - Keep localStorage temp storage?
   - Implement server-side session?
   - Require signup before showing join option?

3. **Should join API route be removed?**
   - If yes, what replaces it?
   - Server actions?
   - Direct domain function calls?

---

## Next Steps

1. ✅ Document current mutation behavior (this doc)
2. ⏳ Decide on join flow architecture
3. ⏳ Implement chosen approach
4. ⏳ Test both authenticated and unauthenticated flows
5. ⏳ Update documentation





