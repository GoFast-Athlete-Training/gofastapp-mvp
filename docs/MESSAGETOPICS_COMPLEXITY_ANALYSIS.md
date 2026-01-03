# messageTopics Column Complexity Analysis

**Date:** January 3, 2025  
**Issue:** Added complexity to hydrate functions to handle missing `messageTopics` column  
**Status:** 🔴 Temporary workaround - needs migration

---

## Problem

The `messageTopics` column is defined in Prisma schema but doesn't exist in the database yet. This causes Prisma queries to fail with `P2022` error (column does not exist).

---

## Complexity Added

### 1. `hydrateCrew()` - Added Raw SQL Query

**Location:** `lib/domain-runcrew.ts:66-89`

**What we added:**
- Extra raw SQL query to check if `messageTopics` column exists
- Try/catch around raw query
- Fallback to default `['general', 'runs', 'social']`
- Changed from `include` to `select` to exclude `messageTopics` from Prisma query

**Impact:**
- ⚠️ **Extra database query** (raw SQL) before main query
- ⚠️ **More complex code** - two queries instead of one
- ⚠️ **Performance hit** - additional round trip to database

**Before:**
```typescript
const crew = await prisma.runCrew.findUnique({
  where: { id: runCrewId },
  include: { ... }
});
// crew.messageTopics || ['general', 'runs', 'social']
```

**After:**
```typescript
// Extra query #1: Check if messageTopics exists
let messageTopics = ['general', 'runs', 'social'];
try {
  const crewWithTopics = await prisma.$queryRaw`...`;
  // parse messageTopics
} catch { /* use default */ }

// Query #2: Main query (excludes messageTopics)
const crew = await prisma.runCrew.findUnique({
  select: { ... } // excludes messageTopics
});
```

---

### 2. `hydrateAthlete()` - Changed to `select` for RunCrew

**Location:** `lib/domain-athlete.ts:44-69`

**What we added:**
- Changed `runCrew` from `include` to `select`
- Explicitly excluded `messageTopics` field
- Added `P2022` error code to error handling

**Impact:**
- ⚠️ **More verbose code** - must explicitly list all fields
- ⚠️ **Maintenance burden** - if RunCrew fields change, must update select
- ✅ **No extra query** - just more explicit field selection

**Before:**
```typescript
runCrew: {
  include: { memberships: { ... } }
}
```

**After:**
```typescript
runCrew: {
  select: {
    id: true,
    name: true,
    // ... all fields explicitly listed
    // messageTopics excluded
    memberships: { include: { ... } }
  }
}
```

---

## Questions to Answer

### 1. Do we need to query athlete in hydrateCrew?

**Current:** `hydrateCrew(runCrewId, athleteId?)` - athleteId is optional and not used

**Answer:** No, we don't query athlete in hydrateCrew. The `athleteId` parameter is unused.

### 2. Is this complexity for messages?

**Answer:** No, this is for **message topics** (channels like "general", "runs", "social"), not the messages themselves. Messages are loaded normally via the `messages` relation.

### 3. Did we add unplanned complexity?

**Answer:** Yes. We added:
- Extra raw SQL query in `hydrateCrew()`
- More verbose `select` statements
- Error handling for missing column

This was a **temporary workaround** to handle missing database column.

---

## Recommended Solution

### Option 1: Run Migration (BEST)

Add the `messageTopics` column to the database:

```sql
ALTER TABLE run_crews ADD COLUMN messageTopics JSON;
```

Then revert our changes:
- Remove raw SQL query from `hydrateCrew()`
- Change back to `include` in `hydrateAthlete()`
- Remove `P2022` error handling

### Option 2: Remove messageTopics from Schema (IF NOT NEEDED)

If we don't need messageTopics yet:
- Remove from Prisma schema
- Remove from all code references
- Add back later when needed

### Option 3: Keep Workaround (TEMPORARY)

Keep current workaround until migration can be run.

---

## Files Modified

1. `lib/domain-runcrew.ts` - Added raw SQL query + select
2. `lib/domain-athlete.ts` - Changed to select + error handling
3. `app/api/runcrew/[id]/route.ts` - Added error handling for PUT

---

## Performance Impact

- **hydrateCrew()**: +1 database query (raw SQL)
- **hydrateAthlete()**: No extra queries, just more verbose
- **Overall**: Minimal impact, but unnecessary complexity

---

## Next Steps

1. ✅ Document complexity (this file)
2. ⏳ Run migration to add `messageTopics` column
3. ⏳ Revert workaround code after migration
4. ⏳ Test to ensure everything works

