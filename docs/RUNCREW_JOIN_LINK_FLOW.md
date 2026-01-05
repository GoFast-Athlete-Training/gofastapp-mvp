# RunCrew Invite Link Flow - MVP1

**Date:** 2025-01-XX  
**Status:** ✅ Complete  
**Route:** `/join/crew/[crewId]`

---

## Overview

The RunCrew invite link flow allows users to join a RunCrew via a shareable link. The flow handles both authenticated and unauthenticated users, automatically joining them to the crew after signup/login.

---

## Route Structure

**Join Page:** `/join/crew/[crewId]`

- **Public Access:** ✅ Yes (no authentication required to view)
- **Parameter:** `crewId` (RunCrew ID from database)

---

## Flow Diagram

```
User visits /join/crew/[crewId]
    ↓
Page fetches crew metadata (public API)
    ↓
Stores crewId in localStorage as 'pendingCrewId'
    ↓
User clicks "Join" button
    ↓
┌─────────────────┬─────────────────┐
│ NOT AUTHENTICATED│  AUTHENTICATED  │
└─────────────────┴─────────────────┘
         ↓                    ↓
Redirect to /signup    Call /api/runcrew/join
         ↓                    ↓
After signup/login     Create membership
         ↓                    ↓
handlePendingCrewJoin()  Redirect to /runcrew/[id]
         ↓
Auto-join via API
         ↓
Redirect to /runcrew/[id]
```

---

## Implementation Details

### 1. Join Page (`/app/join/crew/[crewId]/page.tsx`)

**Responsibilities:**
- Fetch basic RunCrew info (id, name, description, logo) via public API
- Display RunCrew preview card
- Store `crewId` in localStorage as `pendingCrewId` (for signup flow)
- Handle join button click:
  - If NOT authenticated → redirect to `/signup`
  - If authenticated → call `/api/runcrew/join` immediately

**Key Code:**
```typescript
// Store crewId for signup flow
localStorage.setItem('pendingCrewId', crewId);

// If not authenticated, redirect to signup
if (!user) {
  router.push('/signup');
  return;
}

// If authenticated, join immediately
const response = await api.post('/runcrew/join', { crewId });
```

---

### 2. Signup Flow Integration (`/app/signup/page.tsx`)

**After successful signup/login:**
- Checks for `pendingCrewId` in localStorage
- Calls `handlePendingCrewJoin()` function
- Auto-joins the crew via `/api/runcrew/join`
- Redirects to `/runcrew/[id]`
- Clears `pendingCrewId` from localStorage

**Key Code:**
```typescript
const PENDING_CREW_ID_KEY = 'pendingCrewId';

async function handlePendingCrewJoin(router: any): Promise<boolean> {
  const pendingCrewId = localStorage.getItem(PENDING_CREW_ID_KEY);
  if (!pendingCrewId) return false;
  
  const joinRes = await api.post('/runcrew/join', { crewId: pendingCrewId });
  if (joinRes.data?.success) {
    localStorage.removeItem(PENDING_CREW_ID_KEY);
    router.replace(`/runcrew/${joinRes.data.runCrew.id}`);
    return true;
  }
  return false;
}
```

---

### 3. Backend API (`/app/api/runcrew/join/route.ts`)

**Endpoint:** `POST /api/runcrew/join`

**Payload:**
```json
{
  "crewId": "clx123abc"
}
```

**Behavior:**
- Requires authenticated user (Firebase token)
- Creates `run_crew_memberships` record with `role: 'member'`
- Prevents duplicate memberships (unique constraint on `[runCrewId, athleteId]`)
- Returns success with crew data

**Key Code:**
```typescript
// Uses joinCrewById() from domain-runcrew.ts
if (crewId) {
  crew = await joinCrewById(crewId, athlete.id);
}
```

---

### 4. Helper Function (`lib/domain-runcrew.ts`)

**Function:** `getRunCrewJoinLink(runCrewId: string): string`

**Purpose:** Generate shareable invite link (server-side)

**Usage:**
```typescript
import { getRunCrewJoinLink } from '@/lib/domain-runcrew';

const inviteLink = getRunCrewJoinLink('clx123abc');
// Returns: '/join/crew/clx123abc'
```

**Implementation:**
```typescript
export function getRunCrewJoinLink(runCrewId: string): string {
  if (!runCrewId) {
    throw new Error('runCrewId is required');
  }
  return `/join/crew/${runCrewId}`;
}
```

---

## Data Flow

### Temporary State (localStorage)

**Key:** `pendingCrewId`

**Lifecycle:**
1. **Set:** When user visits `/join/crew/[crewId]` page
2. **Used:** After signup/login completes
3. **Cleared:** After successful join OR on error

**Storage:**
- Client-side only (localStorage)
- Persists across page refreshes
- Cleared after join completes

---

## Edge Cases Handled

### 1. Already a Member
- Backend returns existing membership (no error)
- User is redirected to `/runcrew/[id]` (clean redirect)

### 2. Crew Not Found
- Public API returns 404
- Page displays error message
- User can navigate back to discovery page

### 3. Authentication Failure
- API returns 401
- User is redirected to signup
- `pendingCrewId` remains in localStorage

### 4. Duplicate Join Attempt
- Backend unique constraint prevents duplicate
- `joinCrewById()` returns existing crew
- User is redirected normally

---

## Public API Endpoint

**Route:** `/api/runcrew/public/[crewId]`

**Purpose:** Fetch basic RunCrew metadata without authentication

**Returns:**
```json
{
  "success": true,
  "runCrew": {
    "id": "clx123abc",
    "name": "Boston Runners",
    "description": "Running crew in Boston",
    "logo": "https://...",
    "icon": "🏃",
    "joinCode": "BOSTON123"
  }
}
```

**Does NOT return:**
- Memberships
- Messages
- Announcements
- Runs
- Any sensitive data

---

## Acceptance Checklist

✅ Visiting `/join/crew/:id` works logged out  
✅ Signup → auto-joins crew  
✅ Logged-in user joins immediately  
✅ Existing members are redirected cleanly  
✅ User lands on RunCrew home page (`/runcrew/[id]`)  
✅ No schema changes required  
✅ Helper function exists for link generation  

---

## Usage Examples

### Generate Invite Link (Server-Side)

```typescript
import { getRunCrewJoinLink } from '@/lib/domain-runcrew';

// In API route or server component
const inviteLink = getRunCrewJoinLink(runCrew.id);
// Returns: '/join/crew/clx123abc'

// Full URL (if needed)
const fullUrl = `${process.env.NEXT_PUBLIC_BASE_URL}${inviteLink}`;
```

### Share Link in UI

```typescript
// In admin/settings page
const handleCopyInviteLink = async () => {
  const link = getRunCrewJoinLink(runCrew.id);
  const fullUrl = `${window.location.origin}${link}`;
  await navigator.clipboard.writeText(fullUrl);
};
```

---

## Future Enhancements (Not in MVP1)

❌ Short links / URL shortening  
❌ Invite expiration logic  
❌ Email sending  
❌ Token-based invites  
❌ Invite analytics  

---

## Related Files

- **Join Page:** `/app/join/crew/[crewId]/page.tsx`
- **Signup Page:** `/app/signup/page.tsx`
- **Join API:** `/app/api/runcrew/join/route.ts`
- **Public API:** `/app/api/runcrew/public/[crewId]/route.ts`
- **Helper Function:** `/lib/domain-runcrew.ts::getRunCrewJoinLink()`
- **Domain Logic:** `/lib/domain-runcrew.ts::joinCrewById()`

---

## Notes

- The route uses `/join/crew/[crewId]` (not `/runcrew/join/[runCrewId]`) for backward compatibility
- localStorage is used for temporary state (client-side only)
- No server-side sessions required
- MVP1 implementation - no expiration or advanced features

