# RunCrew Patterns Analysis

**Date**: January 2025  
**Purpose**: Document actual patterns used across RunCrew codebase

---

## 🔍 Current State Analysis

### ✅ **Consistent Patterns (Following New Canon)**

#### 1. **runCrewId from Params**
All RunCrew pages correctly get `runCrewId` from URL params:

```typescript
// ✅ ALL PAGES DO THIS CORRECTLY
const params = useParams();
const runCrewId = params.runCrewId as string;
```

**Pages following this:**
- ✅ `/runcrew/[runCrewId]/page.tsx` (Home)
- ✅ `/runcrew/[runCrewId]/member/page.tsx` (Member)
- ✅ `/runcrew/[runCrewId]/admin/page.tsx` (Admin)
- ✅ `/runcrew/[runCrewId]/settings/page.tsx` (Settings)

#### 2. **athleteId from localStorage**
All pages get `athleteId` from localStorage only:

```typescript
// ✅ ALL PAGES DO THIS CORRECTLY
const athleteId = LocalStorageAPI.getAthleteId();
```

**Pages following this:**
- ✅ All 4 RunCrew pages above

#### 3. **API Fetch Pattern**
All pages fetch crew data via API scoped to `runCrewId`:

```typescript
// ✅ CONSISTENT PATTERN
const response = await api.get(`/runcrew/${runCrewId}`);
const crewData = response.data.runCrew;
```

**Pages following this:**
- ✅ All 4 RunCrew pages above

---

## 📦 Data Structure Pattern

### The 5 Boxes Scoped to runCrewId

When fetching `/runcrew/${runCrewId}`, the API returns:

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
    memberships: Array  // ← All members scoped to this runCrewId
  },
  messagesBox: {
    messages: Array     // ← All messages scoped to this runCrewId
  },
  announcementsBox: {
    announcements: Array  // ← All announcements scoped to this runCrewId
  },
  runsBox: {
    runs: Array        // ← All runs scoped to this runCrewId
  },
  joinCodesBox: {
    joinCodes: Array   // ← All join codes scoped to this runCrewId
  }
}
```

### Usage Patterns by Page

#### **Settings Page** - Meta Only
```typescript
// ✅ Settings only touches meta
setCrewName(crewData.meta?.name || '');
setCrewDescription(crewData.meta?.description || '');
setCrewIcon(crewData.meta?.icon || '');
```

#### **Member Page** - All Boxes
```typescript
// ✅ Member page uses all boxes
const memberships = crewData.membershipsBox?.memberships || [];
const announcements = crewData.announcementsBox?.announcements || [];
const messages = crewData.messagesBox?.messages || [];
// (runs and joinCodes available but not displayed on member page)
```

#### **Admin Page** - All Boxes + Meta
```typescript
// ✅ Admin page uses all boxes + meta
setAnnouncements(crewData.announcementsBox?.announcements || []);
setRuns(crewData.runsBox?.runs || []);
const memberships = crewData.membershipsBox?.memberships || [];
let messageTopics = crewData.meta?.messageTopics; // ← Also uses meta
```

#### **Home Page** - Overview
```typescript
// ✅ Home page uses all boxes for overview
const memberships = crewData.membershipsBox?.memberships || [];
const announcements = crewData.announcementsBox?.announcements || [];
const runs = crewData.runsBox?.runs || [];
```

---

## 🔄 Authentication Pattern

### Consistent Auth Flow

All RunCrew pages follow this pattern:

```typescript
useEffect(() => {
  // 1. Check runCrewId exists
  if (!runCrewId) {
    setError('Missing runCrewId');
    return;
  }

  // 2. Prevent multiple fetches
  if (hasFetchedRef.current) {
    return;
  }

  // 3. Wait for Firebase auth
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (hasFetchedRef.current) return;

    // 4. Check Firebase user
    if (!firebaseUser) {
      hasFetchedRef.current = true;
      router.push('/signup');
      return;
    }

    // 5. Mark as fetched
    hasFetchedRef.current = true;

    // 6. Get athleteId from localStorage
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      router.push('/signup');
      return;
    }

    // 7. Fetch crew data
    const response = await api.get(`/runcrew/${runCrewId}`);
    const crewData = response.data.runCrew;

    // 8. Find membership to check role
    const membership = crewData.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athleteId
    );
    setMembership(membership);
  });

  return () => unsubscribe();
}, [runCrewId, router]);
```

**Pages following this:**
- ✅ Home page
- ✅ Member page
- ✅ Settings page
- ⚠️ Admin page (uses `loadCrewData` callback, but same pattern)

---

## 🎯 Page-Specific Patterns

### Settings Page
**Scope**: Meta only (basic crew info)

```typescript
// ✅ Only handles meta fields
const handleSave = async () => {
  await api.put(`/runcrew/${runCrewId}`, {
    name: crewName.trim(),
    description: crewDescription.trim() || null,
    icon: crewIcon.trim() || null,
  });
};
```

### Member Page
**Scope**: Read-only view of all boxes

```typescript
// ✅ Displays all boxes (read-only)
const memberships = crew.membershipsBox?.memberships || [];
const announcements = crew.announcementsBox?.announcements || [];
// Uses MessageFeed component for messages
```

### Admin Page
**Scope**: Full CRUD on all boxes + meta

```typescript
// ✅ Can create/update/delete on all boxes
// - Create announcements
// - Create runs
// - Manage message topics (meta)
// - View all memberships
```

### Home Page
**Scope**: Overview of all boxes

```typescript
// ✅ Shows summary/stats from all boxes
// - Member count
// - Announcement count
// - Upcoming runs count
```

---

## ⚠️ Inconsistencies Found

### 1. **Admin Page Uses Callback Pattern**
Admin page uses `loadCrewData` callback instead of inline useEffect:

```typescript
// ⚠️ DIFFERENT PATTERN (but functionally same)
const loadCrewData = useCallback(async () => {
  // ... same logic
}, [runCrewId, router]);

useEffect(() => {
  // ... calls loadCrewData
}, [loadCrewData]);
```

**Recommendation**: Keep as-is (callback pattern is fine for reusability)

### 2. **Home Page References crew.name**
Home page logs `crewData.name` but should use `crewData.meta?.name`:

```typescript
// ⚠️ INCONSISTENT
console.log(`✅ RUNCREW HOME: Crew loaded successfully: ${crewData.name}`);
```

**Recommendation**: Change to `crewData.meta?.name`

### 3. **Member Page References crew.name**
Member page logs `crewData.name` but should use `crewData.meta?.name`:

```typescript
// ⚠️ INCONSISTENT
console.log(`✅ MEMBER PAGE: Crew loaded successfully: ${crewData.name}`);
```

**Recommendation**: Change to `crewData.meta?.name`

---

## 📊 Summary

### ✅ What's Working Well

1. **Consistent runCrewId sourcing** - All pages use params ✅
2. **Consistent athleteId sourcing** - All pages use localStorage ✅
3. **Consistent API pattern** - All pages fetch from `/runcrew/${runCrewId}` ✅
4. **Consistent auth flow** - All pages use `onAuthStateChanged` ✅
5. **Consistent data structure** - All pages use box structure ✅

### ⚠️ Minor Issues

1. **Logging inconsistencies** - Some pages log `crewData.name` instead of `crewData.meta?.name`
2. **Admin page pattern** - Uses callback (fine, but different from others)

### 🎯 Recommendations

1. **Standardize logging** - Use `crewData.meta?.name` everywhere
2. **Keep admin callback pattern** - It's fine for reusability
3. **Document box structure** - Already done in `RUNCREW_DATA_STRUCTURE.md`

---

## 🔗 Related Documentation

- `NEW_CANON_PATTERNS.md` - New canonical patterns
- `RUNCREW_DATA_STRUCTURE.md` - Data structure deep dive
- `FRONTEND_MVP_FULL_AUDIT.md` - Full feature audit

