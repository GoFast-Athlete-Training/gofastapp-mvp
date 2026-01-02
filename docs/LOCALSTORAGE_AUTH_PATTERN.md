# localStorage Authorization Pattern

## Overview

This app uses **localStorage for athleteId and authorization** via Firebase tokens. This is a client-side only pattern - no cookies, no server-side session management.

## Core Principles

1. **localStorage is the source of truth** for `athleteId` on the client
2. **Firebase tokens** are used for authorization (auto-injected by API interceptor)
3. **Set once on welcome/hydration** - localStorage is set during welcome page hydration
4. **Never removed** - localStorage persists until user explicitly signs out (if implemented)
5. **No cookies** - localStorage only for athlete identity

## Flow

### 1. Welcome Page Hydration

**File**: `app/welcome/page.tsx`

The welcome page is the **only place** where athlete data is hydrated and stored:

```typescript
// 1. Wait for Firebase auth
onAuthStateChanged(auth, async (firebaseUser) => {
  // 2. Call hydrate endpoint
  const response = await api.post('/athlete/hydrate');
  
  // 3. Store in localStorage (THIS IS THE ONLY PLACE)
  LocalStorageAPI.setFullHydrationModel({
    athlete,
    weeklyActivities,
    weeklyTotals
  });
  
  // 4. Show "Let's Train" button (NO auto-redirect)
});
```

**Key Points**:
- ✅ Sets `athleteId` in localStorage
- ✅ Sets full athlete object in localStorage
- ✅ Sets RunCrew data in localStorage
- ✅ Sets weekly activities/totals in localStorage
- ✅ **Only happens once** - on welcome page
- ✅ **Never cleared** - persists across page refreshes

### 2. API Authorization

**File**: `lib/api.ts`

All API requests automatically include Firebase token via interceptor:

```typescript
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(true);
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});
```

**Authorization Flow**:
1. Client reads `athleteId` from localStorage (if needed)
2. Client sends request (token auto-added by interceptor)
3. Server verifies Firebase token
4. Server validates request using token UID

### 3. Client-Side Identity Access

**File**: `hooks/useHydratedAthlete.ts`

Components read identity from localStorage via hook:

```typescript
const { athlete, athleteId, runCrewId } = useHydratedAthlete();
```

**Key Points**:
- ✅ Reads from localStorage (not API calls)
- ✅ No server-side state
- ✅ No cookies
- ✅ Works on client-side pages only

## localStorage Keys

Set by `LocalStorageAPI.setFullHydrationModel()`:

- `athleteId` - Primary identifier
- `athleteProfile` / `athlete` - Full athlete object
- `MyCrew` / `runCrewId` - Primary crew ID
- `MyCrewManagerId` / `runCrewManagerId` - Manager record ID
- `runCrewMemberships` - Array of crew memberships
- `runCrewManagers` - Array of manager records
- `weeklyActivities` - Activity data
- `weeklyTotals` - Weekly totals

## Rules

1. **Set only on welcome/hydration** - localStorage is populated during welcome page hydration
2. **Never automatically cleared** - Data persists until user signs out (manual clear)
3. **No cookies** - All identity stored in localStorage
4. **Client-side only** - Server-side pages cannot access localStorage
5. **Firebase token for API auth** - Token auto-injected, not stored in localStorage

## Migration Notes

- ❌ **Removed**: Cookie-based authentication (`getAthleteIdFromCookie`)
- ❌ **Removed**: `/athlete/[athleteId]` route (was server-side, required cookies)
- ✅ **Using**: localStorage + Firebase tokens
- ✅ **Using**: Client-side pages read from localStorage
- ✅ **Using**: Server-side API routes verify Firebase tokens

## Examples

### Reading Identity

```typescript
// ✅ CORRECT - Use hook
const { athlete, athleteId } = useHydratedAthlete();

// ✅ CORRECT - Direct localStorage read (if not using hook)
const athleteId = LocalStorageAPI.getAthleteId();
const athlete = LocalStorageAPI.getAthlete();
```

### API Calls

```typescript
// ✅ CORRECT - Token auto-added by interceptor
const response = await api.post('/api/endpoint', {
  athleteId: LocalStorageAPI.getAthleteId(), // If needed in body
  // ... other data
});
```

### Navigation

```typescript
// ✅ CORRECT - Client-side navigation
router.push('/athlete-home'); // Reads from localStorage
router.push(`/runcrew/${runCrewId}/member`); // Uses localStorage runCrewId
```

