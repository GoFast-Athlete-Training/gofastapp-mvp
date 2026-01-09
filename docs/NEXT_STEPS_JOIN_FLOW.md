# Next Steps: Join Flow Implementation

**Date:** 2025-01-XX  
**Status:** ⚠️ **CRITICAL - Join functionality is currently broken**

---

## Current State

### ✅ What's Working
- Domain functions exist: `joinCrewById()` and `joinCrew()` in `lib/domain-runcrew.ts`
- Membership mutation works correctly (creates `run_crew_memberships` with `role: 'member'`)
- Database schema supports joining

### ❌ What's Broken
1. **Join page deleted** - `/join/crew/[crewId]` route doesn't exist
2. **API route deleted** - `/api/runcrew/join` doesn't exist
3. **Temp storage removed** - `handlePendingCrewJoin()` removed from signup
4. **Links still point to deleted route** - Member page generates `/join/crew/${runCrewId}` links that 404

---

## The Problem

**Users clicking invite links get 404 errors** because:
- Links point to `/join/crew/[crewId]` 
- That page was deleted
- No alternative join mechanism exists

---

## Recommended Solution: Recreate Join Page with Server Action

### Option 1: Server Action (Recommended)

**Why:**
- Next.js 15 supports server actions natively
- No need for separate API route
- Can handle auth server-side
- Simpler architecture

**Implementation:**

1. **Create join page:** `/app/join/crew/[crewId]/page.tsx`
   - Public page (no auth required to view)
   - Shows crew preview
   - "Join" button that calls server action

2. **Create server action:** `/app/join/crew/[crewId]/actions.ts`
   ```typescript
   'use server'
   
   import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
   import { joinCrewById } from '@/lib/domain-runcrew';
   import { cookies } from 'next/headers';
   import { adminAuth } from '@/lib/firebaseAdmin';
   
   export async function joinCrewAction(crewId: string) {
     // Get Firebase token from cookies/headers
     // Verify token
     // Get athlete
     // Call joinCrewById()
     // Return success/error
   }
   ```

3. **Restore temp storage for unauthenticated users:**
   - Store `pendingCrewId` in localStorage when visiting join page
   - After signup/login, check for `pendingCrewId` and auto-join
   - Add back to signup page (but call server action instead of API)

---

### Option 2: New API Route (Simpler, but less modern)

**Why:**
- Quick to implement
- Reuses existing patterns
- Can copy from deleted route

**Implementation:**

1. **Recreate API route:** `/app/api/runcrew/join/route.ts`
   - Copy from git history
   - Same as before

2. **Recreate join page:** `/app/join/crew/[crewId]/page.tsx`
   - Public page
   - Calls API route when authenticated
   - Stores `pendingCrewId` for unauthenticated users

3. **Restore temp storage:**
   - Add `handlePendingCrewJoin()` back to signup
   - But keep it simple

---

### Option 3: Inline Join on Crew Page (No separate join page)

**Why:**
- Simplest UX
- No separate join page needed
- Join button directly on `/runcrew/[id]` page

**Implementation:**

1. **Add "Join" button to crew page:**
   - Show if user is NOT a member
   - Hide if already a member
   - Calls server action or API route

2. **Handle unauthenticated users:**
   - If not logged in, redirect to signup with `?redirect=/runcrew/[id]`
   - After signup, redirect back and show join button
   - OR: Require signup before showing crew page

**Trade-off:**
- Links shared will go to crew page (not dedicated join page)
- Less "invite-focused" but simpler

---

## Immediate Action Required

### Step 1: Fix Broken Links (Quick Fix)

**Update member page to use crew URL instead of join URL:**

```typescript
// In app/runcrew/[runCrewId]/member/page.tsx
// Change line 209 from:
const inviteUrl = `${origin}/join/crew/${runCrewId}`;
// To:
const inviteUrl = `${origin}/runcrew/${runCrewId}`;
```

**This makes links work immediately** (they'll go to crew page, user can join there if button exists)

---

### Step 2: Choose Implementation Approach

**Recommendation: Option 1 (Server Action)**

**Why:**
- Modern Next.js pattern
- Cleaner architecture
- Better type safety
- No separate API route needed

**Time estimate:** 1-2 hours

---

### Step 3: Implement Chosen Solution

**If Option 1 (Server Action):**

1. Create `/app/join/crew/[crewId]/page.tsx`
2. Create `/app/join/crew/[crewId]/actions.ts` (server action)
3. Add temp storage back to signup page
4. Update member page to use `/join/crew/[crewId]` links again

**If Option 2 (API Route):**

1. Recreate `/app/api/runcrew/join/route.ts`
2. Create `/app/join/crew/[crewId]/page.tsx`
3. Add `handlePendingCrewJoin()` back to signup
4. Update member page to use `/join/crew/[crewId]` links again

**If Option 3 (Inline Join):**

1. Add "Join" button to `/app/runcrew/[runCrewId]/page.tsx`
2. Create server action or API route for joining
3. Update member page to use `/runcrew/[crewId]` links (already done in Step 1)

---

## Decision Matrix

| Option | Pros | Cons | Time | Recommended |
|--------|------|------|------|-------------|
| **1. Server Action** | Modern, clean, type-safe | Newer pattern, less familiar | 1-2h | ✅ **Yes** |
| **2. API Route** | Familiar, quick | Extra route, less modern | 30min | Maybe |
| **3. Inline Join** | Simplest, no extra page | Less "invite-focused" | 1h | Maybe |

---

## Questions to Answer

1. **Do you want a dedicated join page?**
   - Yes → Option 1 or 2
   - No → Option 3

2. **Do you want temp storage for unauthenticated users?**
   - Yes → Need to restore `handlePendingCrewJoin()` logic
   - No → Require signup first, then show join option

3. **What should happen when unauthenticated user clicks invite link?**
   - Option A: Show join page, redirect to signup, auto-join after
   - Option B: Redirect to signup immediately, join after signup
   - Option C: Show crew page, require signup, then show join button

---

## Quick Fix (Do This Now)

**Update member page invite URL to point to crew page instead of join page:**

```typescript
// app/runcrew/[runCrewId]/member/page.tsx
// Line 209 - Change to:
const inviteUrl = runCrewId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/runcrew/${runCrewId}` : '';
```

This makes shared links work immediately (they'll go to crew page).

---

## Next Steps Summary

1. ✅ **Immediate:** Fix member page invite URL (use crew page)
2. ⏳ **Decide:** Choose implementation approach (1, 2, or 3)
3. ⏳ **Implement:** Build chosen solution
4. ⏳ **Test:** Test both authenticated and unauthenticated flows
5. ⏳ **Update:** Update member page to use join links again (if using Option 1 or 2)


