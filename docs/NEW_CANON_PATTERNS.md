# New Canon Patterns - From Here Forward

**Date**: January 2025  
**Status**: ⚠️ **ACTIVE REFACTORING** - All new code must follow these patterns

---

## Core Principles

### 1. localStorage for athleteId ONLY
- ✅ **ONLY** store `athleteId` in localStorage
- ❌ **NO** other identity data in localStorage
- ❌ **NO** crew data in localStorage
- ❌ **NO** profile data in localStorage

```typescript
// ✅ CORRECT
const athleteId = LocalStorageAPI.getAthleteId();

// ❌ WRONG
const athlete = LocalStorageAPI.getAthleteProfile();
const crew = LocalStorageAPI.getRunCrewData();
```

---

### 2. runCrewId from Params ONLY
- ✅ **ALWAYS** get `runCrewId` from URL params
- ❌ **NEVER** get `runCrewId` from localStorage
- ❌ **NEVER** get `runCrewId` from hooks

```typescript
// ✅ CORRECT
const params = useParams();
const runCrewId = params.runCrewId as string;

// ❌ WRONG
const runCrewId = LocalStorageAPI.getMyCrew();
const { runCrewId } = useHydratedAthlete();
```

---

### 3. Everything Scoped to Params
- All data fetching is **scoped to the runCrewId in the URL**
- No global state, no localStorage caching
- Each page fetches what it needs based on URL params

```typescript
// ✅ CORRECT - Scoped to param
const response = await api.get(`/runcrew/${runCrewId}`);

// ❌ WRONG - Using cached data
const crew = LocalStorageAPI.getRunCrewData();
```

---

## RunCrew Container Structure

### The 5 Things Scoped to runCrewId

When you fetch `/runcrew/${runCrewId}`, you get a container with 5 scoped boxes:

```typescript
{
  meta: {
    runCrewId: string,
    name: string,
    description: string,
    joinCode: string,
    logo: string,
    icon: string,
    messageTopics: string[]
  },
  membershipsBox: {
    memberships: Array  // ← Scoped to runCrewId
  },
  messagesBox: {
    messages: Array    // ← Scoped to runCrewId
  },
  announcementsBox: {
    announcements: Array  // ← Scoped to runCrewId
  },
  runsBox: {
    runs: Array        // ← Scoped to runCrewId
  },
  joinCodesBox: {
    joinCodes: Array   // ← Scoped to runCrewId
  }
}
```

**All 5 boxes are scoped to the runCrewId in the URL params.**

---

## Settings Page Pattern

### Scope: Basic Info Only (meta level)

Settings page **ONLY** handles the `meta` object:
- `name`
- `description`
- `icon`
- `logo`
- `joinCode`
- `messageTopics`

Settings does **NOT** touch:
- ❌ membershipsBox
- ❌ messagesBox
- ❌ announcementsBox
- ❌ runsBox
- ❌ joinCodesBox

### Settings Page Code Pattern

```typescript
'use client';

import { useParams } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function RunCrewSettingsPage() {
  // ✅ NEW CANON: runCrewId from params
  const params = useParams();
  const runCrewId = params.runCrewId as string;

  // ✅ NEW CANON: athleteId from localStorage only
  const athleteId = LocalStorageAPI.getAthleteId();

  useEffect(() => {
    // ✅ NEW CANON: Fetch crew scoped to runCrewId param
    const response = await api.get(`/runcrew/${runCrewId}`);
    const crewData = response.data.runCrew;

    // ✅ NEW CANON: Settings only handles meta (basic info)
    setCrewName(crewData.meta?.name || '');
    setCrewDescription(crewData.meta?.description || '');
    setCrewIcon(crewData.meta?.icon || '');
  }, [runCrewId]);

  const handleSave = async () => {
    // ✅ NEW CANON: Update only meta fields
    await api.put(`/runcrew/${runCrewId}`, {
      name: crewName.trim(),
      description: crewDescription.trim() || null,
      icon: crewIcon.trim() || null,
    });
  };
}
```

---

## Migration Checklist

### Pages to Refactor

- [ ] `/runcrew/[runCrewId]/settings` - ✅ DONE (meta only)
- [ ] `/runcrew/[runCrewId]/member` - Refactor to use params only
- [ ] `/runcrew/[runCrewId]/admin` - Refactor to use params only
- [ ] `/runcrew/[runCrewId]` (home) - Refactor to use params only

### What to Remove

- [ ] Remove `LocalStorageAPI.getRunCrewData()` usage
- [ ] Remove `LocalStorageAPI.setRunCrewData()` usage
- [ ] Remove `LocalStorageAPI.getMyCrew()` usage
- [ ] Remove `LocalStorageAPI.setMyCrew()` usage
- [ ] Remove `useHydratedAthlete()` hook (or refactor to only return athleteId)

### What to Keep

- ✅ `LocalStorageAPI.getAthleteId()` - ONLY this
- ✅ URL params for runCrewId
- ✅ API calls scoped to params

---

## Benefits

1. **Clear Data Flow**: Params → API → Component
2. **No Cache Issues**: Always fresh data from API
3. **Simple Mental Model**: URL = source of truth
4. **Easy Debugging**: Can see runCrewId in URL
5. **No Stale Data**: No localStorage cache to get out of sync

---

## Anti-Patterns (DO NOT DO)

❌ **Don't cache crew data in localStorage**
```typescript
// ❌ WRONG
const crew = LocalStorageAPI.getRunCrewData();
if (crew) {
  // use cached data
}
```

❌ **Don't get runCrewId from localStorage**
```typescript
// ❌ WRONG
const runCrewId = LocalStorageAPI.getMyCrew();
```

❌ **Don't use hooks for crew data**
```typescript
// ❌ WRONG
const { runCrew } = useHydratedAthlete();
```

✅ **DO get runCrewId from params**
```typescript
// ✅ CORRECT
const params = useParams();
const runCrewId = params.runCrewId as string;
```

