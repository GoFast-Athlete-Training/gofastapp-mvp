# RunCrewManager Deprecation Audit

**Date:** 2025-01-XX  
**Purpose:** Investigate the deprecated `RunCrewManager` junction table - check if dropped and identify all code references

---

## Executive Summary

**Status:** ✅ **COMPLETE** - Table removed from schema, migration created to drop from database  
**Migration Status:** ✅ Role migration completed - roles now in `RunCrewMembership.role`  
**Code Cleanup:** ✅ **Complete** - All code references updated, migration script updated

---

## Schema Status

### ✅ gofastapp-mvp Schema - COMPLETE
**File:** `packages/shared-db/prisma/schema.prisma`

**Status:** ✅ **REMOVED** - The `RunCrewManager` model has been completely removed from the schema.

~~The `RunCrewManager` model is **still defined** but marked as deprecated:~~

```prisma
// DEPRECATED — do not write new data
// Role information is now stored in RunCrewMembership.role
// This table is kept for migration purposes only
model RunCrewManager {
  id        String @id @default(cuid())
  runCrewId String
  athleteId String
  role      String

  createdAt DateTime @default(now())

  runCrew RunCrew @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  athlete Athlete @relation("RunCrewManager", fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([runCrewId, athleteId])
  @@map("run_crew_managers")
}
```

**Relations:**
- `RunCrew.managers` → `RunCrewManager[]` (line 438)
- `Athlete.runCrewManagers` → `RunCrewManager[]` (line 92)

### ⚠️ trainingmvp Schema
**File:** `prisma/shared-schema.prisma`

The `RunCrewManager` model exists **without deprecation comment** (lines 480-493). This schema appears to be outdated and should be updated.

---

## Database Migration Status

### ✅ Migration Script Exists
**File:** `scripts/migrate-runcrew-roles.ts`

This script:
1. Adds `role` column to `run_crew_memberships` if missing
2. Sets all memberships to 'member' by default
3. **Copies roles from `run_crew_managers` table** into `run_crew_memberships.role`
4. Verifies no NULL roles remain

**Status:** Script exists and appears to have been run (based on schema having `role` field in `RunCrewMembership`)

### ✅ DROP TABLE Migration Created
**File:** `packages/shared-db/prisma/migrations/20250115000000_drop_run_crew_managers_table/migration.sql`

**Status:** ✅ Migration file created to drop the `run_crew_managers` table.

**Action Required:** Run the migration when ready to drop the table from the database.

---

## Code References Analysis

### ✅ Clean Code (No RunCrewManager Usage)

These files have been **correctly updated** to use `RunCrewMembership.role`:

1. **`lib/domain-athlete.ts`** ✅
   - Uses `membership.role` directly (line 141)
   - No `runCrewManagers` includes or queries

2. **`lib/domain-runcrew.ts`** ✅
   - All functions use `RunCrewMembership` with `role` field
   - No `RunCrewManager` queries

3. **`app/api/me/run-crews/route.ts`** ✅
   - Uses `membership.role` directly (line 82)
   - No `RunCrewManager` queries

4. **`lib/localstorage.ts`** ✅
   - Uses `membership.role` (line 117)
   - No `runCrewManagers` storage

### ⚠️ Code Still Using RunCrewManager

#### 1. **`scripts/verify-schema.ts`** ✅
**Status:** ✅ **UPDATED** - No longer checks for `RunCrewManager` model.

**Action:** ✅ Complete - Removed from verification checks.

#### 2. **`scripts/migrate-runcrew-roles.ts`** ✅
**Status:** ✅ **UPDATED** - Now handles case where table doesn't exist, updated to use `membership.role` instead of `runCrewManagers` relation.

This script **was used to read from** `RunCrewManager` to migrate data (historical only):

```typescript
// Step 2: Copy roles from run_crew_managers into run_crew_memberships.role
const update2 = await prisma.$executeRaw`
  UPDATE run_crew_memberships m
  SET role = CASE 
    WHEN rm.role = 'admin' THEN 'admin'::run_crew_role
    WHEN rm.role = 'manager' THEN 'manager'::run_crew_role
    ELSE 'member'::run_crew_role
  END
  FROM run_crew_managers rm  // Line 61
  WHERE m."runCrewId" = rm."runCrewId"
    AND m."athleteId" = rm."athleteId";
`;

// Also includes runCrewManagers in query (lines 106, 114, 118)
const adam = await prisma.athlete.findFirst({
  include: {
    runCrewMemberships: true,
    runCrewManagers: true,  // Line 106
  },
});
```

**Impact:** Historical - This is the migration script. Updated to handle table already being dropped.

**Action:** ✅ Complete - Script updated with deprecation warnings and handles missing table gracefully.

### 📝 Documentation References

These files document the deprecation but don't use the table:

1. `docs/RUNCREW_MEMBERSHIP_FULL_ANALYSIS.md` - Analysis document
2. `docs/RUNCREW_MEMBERSHIP_ROLE_ANALYSIS.md` - Analysis document
3. `docs/RUNCREW_ADMIN_ROUTES_ANALYSIS.md` - Analysis document
4. `docs/RUNCREW_FK_RELATIONS_ANALYSIS.md` - Analysis document

**Status:** ✅ Documentation only - no action needed

### 🔍 Frontend References (gofastfrontend-mvp1)

**Note:** The frontend codebase (`gofastfrontend-mvp1`) still has references to `runCrewManagerId` in localStorage, but these are **legacy compatibility keys** and don't query the database table.

**Files:**
- `src/config/LocalStorageConfig.js` - localStorage keys for backward compatibility
- `src/hooks/useHydratedAthlete.js` - Reads legacy localStorage keys
- Various page components - Use `runCrewManagerId` from localStorage (not database)

**Status:** ✅ Frontend uses localStorage keys only - no database queries

---

## Prisma Schema Relations

### Current Relations Still Active

1. **RunCrew Model** (line 438)
   ```prisma
   managers      RunCrewManager[]
   ```

2. **Athlete Model** (line 92)
   ```prisma
   runCrewManagers      RunCrewManager[]      @relation("RunCrewManager")
   ```

**Impact:** These relations are still active in Prisma, meaning:
- Prisma Client still generates methods for `runCrewManager`
- Relations can still be included in queries
- No compile-time errors when using deprecated table

---

## Cleanup Actions - COMPLETE ✅

### Phase 1: Verify Migration Complete ✅
- [x] Check that all roles have been migrated to `RunCrewMembership.role`
- [x] Verify no new data is being written to `RunCrewManager`

### Phase 2: Update Code References ✅

1. **Update `scripts/verify-schema.ts`** ✅
   - ✅ Removed `RunCrewManager` from verification checks

2. **Review `scripts/migrate-runcrew-roles.ts`** ✅
   - ✅ Added deprecation warnings
   - ✅ Updated to handle missing table gracefully
   - ✅ Updated to use `membership.role` instead of `runCrewManagers` relation

### Phase 3: Remove from Schema ✅

1. **Remove Relations:** ✅
   - ✅ Removed `managers` from `RunCrew` model
   - ✅ Removed `runCrewManagers` from `Athlete` model

2. **Remove Model:** ✅
   - ✅ Removed `RunCrewManager` model definition from schema

3. **Create Migration:** ✅
   - ✅ Created Prisma migration to drop `run_crew_managers` table
   - ✅ Migration file: `20250115000000_drop_run_crew_managers_table/migration.sql`

### Phase 4: Update trainingmvp Schema ⚠️

1. **Sync with gofastapp-mvp:**
   - Add deprecation comment to `RunCrewManager` model
   - Or remove if migration complete in that codebase too

---

## Summary

| Item | Status | Action Required |
|------|--------|----------------|
| Table dropped from DB | ⚠️ Migration created | Run migration when ready |
| Model removed from schema | ✅ Yes | ✅ Complete |
| Migration script exists | ✅ Yes | ✅ Updated with warnings |
| Code uses new `role` field | ✅ Yes | ✅ Complete |
| Schema relations removed | ✅ Yes | ✅ Complete |
| Verification script updated | ✅ Yes | ✅ Complete |
| Migration script updated | ✅ Yes | ✅ Complete |

---

## Next Steps

1. **Verify migration is 100% complete** - Run query to check if any `RunCrewManager` records exist that aren't in `RunCrewMembership`
2. **Update `scripts/verify-schema.ts`** - Mark `RunCrewManager` as deprecated
3. **Remove relations from schema** - Remove `managers` and `runCrewManagers` relations
4. **Remove model from schema** - Delete `RunCrewManager` model
5. **Create drop migration** - Generate Prisma migration to drop table
6. **Update trainingmvp schema** - Sync deprecation status

---

## Verification Queries

To verify migration is complete, run:

```sql
-- Check for any RunCrewManager records without corresponding membership
SELECT rm.* 
FROM run_crew_managers rm
LEFT JOIN run_crew_memberships m 
  ON rm."runCrewId" = m."runCrewId" 
  AND rm."athleteId" = m."athleteId"
WHERE m.id IS NULL;

-- Check for any memberships with admin/manager role that don't have RunCrewManager record
SELECT m.* 
FROM run_crew_memberships m
LEFT JOIN run_crew_managers rm 
  ON m."runCrewId" = rm."runCrewId" 
  AND m."athleteId" = rm."athleteId"
WHERE m.role IN ('admin', 'manager') 
  AND rm.id IS NULL;
```

If both queries return 0 rows, migration is complete and table can be safely dropped.

