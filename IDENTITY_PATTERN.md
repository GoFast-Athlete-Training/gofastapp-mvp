# Identity & Authorization Pattern

## Overview

This document describes the identity and authorization pattern used in GoFast MVP1. The pattern uses **localStorage** for client-side identity storage and **request body parameters** for API calls, with **Firebase token verification** for authorization.

## Core Principles

1. **localStorage is the source of truth** for `athleteId` on the client
2. **Client sends `athleteId`** in request body for API calls
3. **API routes verify** that `athleteId` matches the Firebase token
4. **No cookies** - localStorage only
5. **No hooks as identity source** - read directly from localStorage
6. **RunCrew routes use `runCrewId` as URL param** (not `athleteId`) because membership isn't always hydrated and is harder to set for multiple RunCrews

## Flow

### 1. Bootstrap Identity (Welcome Page)

**File**: `app/welcome/page.tsx`

```typescript
// 1. User authenticates with Firebase
// 2. Call /api/athlete/hydrate (or /api/athlete/create if 404)
// 3. Get athleteId from response
// 4. Store athleteId in localStorage
LocalStorageAPI.setAthleteId(athleteId);
// 5. Redirect to /athlete/[athleteId]
```

**Purpose**: Bootstrap identity once, store in localStorage for all subsequent requests.

### 2. Client-Side API Calls

**Pattern**: Client reads `athleteId` from localStorage and sends it in request body.

```typescript
// Client-side code (e.g., admin page creating a run)
const athleteId = LocalStorageAPI.getAthleteId();

const response = await api.post('/api/runcrew/[runCrewId]/runs', {
  athleteId,  // Send athleteId in body
  title: 'Morning Run',
  date: '2024-01-15',
  // ... other fields
});
```

**Key Points**:
- Always read `athleteId` from `LocalStorageAPI.getAthleteId()`
- Include `athleteId` in request body
- Do NOT use hooks to store/access identity
- Do NOT pass `athleteId` in URL params (except for page routing)

### 3. API Route Pattern

**Template for API routes that need identity**:

```typescript
export async function POST(request: Request) {
  // 1. Parse request body to get athleteId
  const body = await request.json();
  const { athleteId, ...otherFields } = body;
  
  if (!athleteId) {
    return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
  }

  // 2. Verify Firebase token (authentication)
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
  const firebaseId = decodedToken.uid;

  // 3. Verify athleteId matches Firebase token (authorization)
  const athlete = await getAthleteByFirebaseId(firebaseId);
  if (!athlete || athlete.id !== athleteId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Use athlete.id for authorship/authorization
  // ... rest of route logic
}
```

**Key Points**:
- Accept `athleteId` in request body
- Verify Firebase token for authentication
- Verify `athleteId` matches the token's athlete (authorization)
- Use `athlete.id` for database operations (not the body `athleteId` directly)

### 4. RunCrew Routes Pattern

**URL Structure**: `/runcrew/[runCrewId]/member` and `/runcrew/[runCrewId]/admin`

**Why `runCrewId` as URL param?**
- Membership isn't always called at hydrate
- Harder to set for multiple RunCrews
- More flexible for membership-based operations
- Create routes (runs/events) function better with this pattern

**Example API route**: `/api/runcrew/[runCrewId]/runs`

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runCrewId } = await params;  // URL param
  
  const body = await request.json();
  const { athleteId, ...runData } = body;  // Request body
  
  // Verify athleteId matches Firebase token
  // Use athleteId for authorship in createRun()
  await createRun({
    runCrewId,        // From URL param
    createdById: athlete.id,  // From verified athlete
    ...runData
  });
}
```

## API Route Examples

### GET /api/me/run-crews

**Client**:
```typescript
const athleteId = LocalStorageAPI.getAthleteId();
const response = await api.post('/api/me/run-crews', { athleteId });
```

**Server**:
- Accepts `athleteId` in POST body (changed from GET)
- Verifies `athleteId` matches Firebase token
- Returns all RunCrew memberships for that athlete

### POST /api/runcrew/[runCrewId]/runs

**Client**:
```typescript
const athleteId = LocalStorageAPI.getAthleteId();
const response = await api.post(`/api/runcrew/${runCrewId}/runs`, {
  athleteId,
  title: 'Morning Run',
  date: '2024-01-15',
  // ... other fields
});
```

**Server**:
- Accepts `runCrewId` from URL param
- Accepts `athleteId` and run data in POST body
- Verifies `athleteId` matches Firebase token
- Verifies athlete is admin/manager of the RunCrew
- Creates run with `createdById: athlete.id`

## Server Components

**For server components that need `athleteId`**:
- **Option 1**: Use URL param (e.g., `/athlete/[athleteId]/page.tsx`)
- **Option 2**: Convert to client component and read from localStorage
- **Option 3**: Call API route from client component wrapper

**Example**: `/athlete/[athleteId]/page.tsx` (server component)
- Reads `athleteId` from URL param
- Fetches data server-side using Prisma
- No localStorage access (server-side)

## Do's and Don'ts

### ✅ Do

- Store `athleteId` in localStorage after hydrate/create
- Read `athleteId` from `LocalStorageAPI.getAthleteId()` for API calls
- Send `athleteId` in request body for API routes
- Verify `athleteId` matches Firebase token in API routes
- Use `runCrewId` as URL param for RunCrew routes
- Use URL params for page routing (e.g., `/athlete/[athleteId]`)

### ❌ Don't

- Don't use cookies for `athleteId`
- Don't use React hooks as identity source
- Don't derive `athleteId` from Firebase token in API routes (client sends it)
- Don't pass `athleteId` in URL params for API calls (use body)
- Don't trust `athleteId` from client without verifying against Firebase token

## Migration Notes

**Removed**:
- Cookie utilities (`lib/server/cookies.ts`)
- Cookie setters in `/api/athlete/create` and `/api/athlete/hydrate`
- Cookie getters in server components

**Added**:
- localStorage storage in welcome page
- Request body `athleteId` parameter in API routes
- Verification pattern (Firebase token → athlete lookup → compare IDs)

## Benefits

1. **Simpler**: Single source of truth (localStorage) on client
2. **Flexible**: Easy to work with multiple RunCrews
3. **Secure**: Firebase token verification ensures authorization
4. **Clear**: Explicit `athleteId` in request body makes authorship obvious
5. **Testable**: Easy to mock localStorage for testing



