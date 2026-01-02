# RunCrew Membership & Role Architecture - Full Analysis

**Date:** 2025-01-XX  
**Purpose:** Complete analysis of the dual junction table design and identification of all gaps, inconsistencies, and refactoring requirements

---

## Executive Summary

**CRITICAL ISSUE:** We have **two separate junction tables** for the same relationship (Athlete ↔ RunCrew):

1. `RunCrewMembership` - Tracks membership (who is in which crew)
2. `RunCrewManager` - Tracks roles (who is admin/manager in which crew)

**Problem:** This creates data duplication, query complexity, synchronization issues, and inconsistent state risks.

**Solution:** Consolidate into a single junction table (`RunCrewMembership`) with a `role` field.

---

## Current Schema Architecture

### Dual Junction Table Design

```prisma
// Junction Table #1: Membership
model RunCrewMembership {
  id        String @id @default(cuid())
  runCrewId String
  athleteId String
  joinedAt  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  runCrew RunCrew @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  athlete Athlete @relation("AthleteRunCrewMemberships", fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([runCrewId, athleteId])
  @@map("run_crew_memberships")
}

// Junction Table #2: Roles (SEPARATE TABLE - PROBLEM!)
model RunCrewManager {
  id        String @id @default(cuid())
  runCrewId String  // DUPLICATE: Also in RunCrewMembership
  athleteId String  // DUPLICATE: Also in RunCrewMembership
  role      String  // "admin" or "manager"
  createdAt DateTime @default(now())

  runCrew RunCrew @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  athlete Athlete @relation("RunCrewManager", fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([runCrewId, athleteId])
  @@map("run_crew_managers")
}
```

**Key Problem:** Both tables store `runCrewId + athleteId`, creating redundant data.

---

## Complete Process Flow Analysis

### 1. Creating a RunCrew (Current Implementation)

**Location:** `lib/domain-runcrew.ts::createCrew()`

```typescript
// Step 1: Create crew
const crew = await prisma.runCrew.create({ ... });

// Step 2: Create membership (NO ROLE)
await prisma.runCrewMembership.create({
  data: { runCrewId: crew.id, athleteId: data.athleteId }
});

// Step 3: Create admin role (SEPARATE TABLE!)
await prisma.runCrewManager.create({
  data: { runCrewId: crew.id, athleteId: data.athleteId, role: 'admin' }
});
```

**Gap Analysis:**
- ✅ Creates membership (required)
- ✅ Creates manager record (required)
- ❌ **Two separate writes** - not atomic
- ❌ **Data duplication** - runCrewId + athleteId in both tables
- ❌ **Potential inconsistency** - membership could exist without manager record (if Step 3 fails)
- ❌ **No transaction** - partial failures possible

---

### 2. Joining a RunCrew (Current Implementation)

**Location:** `lib/domain-runcrew.ts::joinCrew()` and `joinCrewById()`

```typescript
// Step 1: Check existing membership
const existingMembership = await prisma.runCrewMembership.findUnique({ ... });

// Step 2: Create membership (NO ROLE SET - defaults to member)
await prisma.runCrewMembership.create({
  data: { runCrewId: crew.id, athleteId }
});

// NO RunCrewManager record created (member is implicit)
```

**Gap Analysis:**
- ✅ Creates membership
- ✅ No manager record (correct - they're a member, not admin)
- ❌ **Role information is MISSING** from membership table
- ❌ **Role must be inferred** by checking RunCrewManager table
- ❌ **Two-step query required** to determine if someone is admin or member

---

### 3. Hydrating Athlete Data (Current Implementation)

**Location:** `lib/domain-athlete.ts::hydrateAthlete()`

```typescript
// Step 1: Fetch athlete with BOTH relations
athlete = await prisma.athlete.findUnique({
  where: { id: athleteId },
  include: {
    runCrewMemberships: { include: { runCrew: { ... } } },
    runCrewManagers: { include: { runCrew: true } }  // SEPARATE RELATION
  }
});

// Step 2: Combine the two arrays in code
const crews = athlete.runCrewMemberships.map((membership: any) => {
  // Must look up role from SEPARATE array
  const managerRole = athlete.runCrewManagers.find(
    (m: any) => m.runCrewId === membership.runCrewId
  );
  return {
    ...membership.runCrew,
    role: managerRole?.role || 'member',  // Fallback if not found
    joinedAt: membership.joinedAt,
  };
});
```

**Gap Analysis:**
- ✅ Fetches both relations
- ✅ Combines them correctly
- ❌ **Requires JOIN of two separate arrays** in application code
- ❌ **O(n*m) complexity** - for each membership, search manager array
- ❌ **Inefficient** - two database queries/relations instead of one
- ❌ **Error-prone** - easy to forget the lookup or get the mapping wrong

---

### 4. API: Get My RunCrews (Current Implementation)

**Location:** `app/api/me/run-crews/route.ts`

```typescript
// Step 1: Fetch memberships
const memberships = await prisma.runCrewMembership.findMany({
  where: { athleteId },
  include: { runCrew: { select: { id: true, name: true } } }
});

// Step 2: Fetch manager records (SEPARATE QUERY)
const managerRecords = await prisma.runCrewManager.findMany({
  where: { athleteId },
  select: { runCrewId: true, role: true }
});

// Step 3: Combine in code
const runCrews = memberships.map((membership) => {
  const managerRecord = managerRecords.find(
    (m) => m.runCrewId === membership.runCrewId
  );
  const role = managerRecord?.role === 'admin' ? 'ADMIN' : 'MEMBER';
  return { membershipId, runCrewId, runCrewName, role };
});
```

**Gap Analysis:**
- ✅ Returns correct data
- ❌ **Two separate database queries**
- ❌ **Manual join in application code**
- ❌ **O(n*m) array search** for each membership
- ❌ **Cannot filter by role in single query** (e.g., "get only admin crews")

---

### 5. Checking Admin Status (Current Implementation)

**Location:** `app/runcrew/[runCrewId]/admin/page.tsx`

```typescript
// Step 1: Check membership
const membership = await prisma.runCrewMembership.findUnique({
  where: { runCrewId_athleteId: { runCrewId, athleteId } }
});

// Step 2: Check manager record (SEPARATE QUERY)
const managerRecord = await prisma.runCrewManager.findUnique({
  where: { runCrewId_athleteId: { runCrewId, athleteId } }
});

// Step 3: Determine role
const isAdmin = managerRecord?.role === 'admin';
```

**Gap Analysis:**
- ✅ Works correctly
- ❌ **Two database queries for simple role check**
- ❌ **Cannot check role in single query**
- ❌ **Performance overhead** - two round trips to database

---

### 6. Hydrating Crew Context (Current Implementation)

**Location:** `lib/domain-runcrew.ts::hydrateCrew()`

```typescript
const crew = await prisma.runCrew.findUnique({
  where: { id: runCrewId },
  include: {
    memberships: { include: { athlete: { ... } } },
    managers: { include: { athlete: { ... } } }  // SEPARATE INCLUDE
  }
});

// Determine user's role
let userRole = 'member';
if (athleteId) {
  const manager = crew.managers.find((m) => m.athleteId === athleteId);
  userRole = manager?.role || 'member';
}
```

**Gap Analysis:**
- ✅ Fetches both relations
- ✅ Determines role correctly
- ❌ **Two separate includes** (memberships and managers)
- ❌ **Must search manager array** to find role
- ❌ **Inefficient** - loads all managers when we only need one role

---

### 7. LocalStorage Hydration (Current Implementation)

**Location:** `lib/localstorage.ts::setFullHydrationModel()`

```typescript
// Store both arrays separately
if (athlete.runCrewMemberships) {
  localStorage.setItem('runCrewMemberships', JSON.stringify(athlete.runCrewMemberships));
}
if (athlete.runCrewManagers) {
  localStorage.setItem('runCrewManagers', JSON.stringify(athlete.runCrewManagers));
}

// Later: Combine them in application code
const memberships = model?.runCrewMemberships || [];
const managers = model?.runCrewManagers || [];

const crews = memberships.map((membership) => {
  const managerRecord = managers.find(
    (m: any) => m.runCrewId === membership.runCrewId
  );
  const role = managerRecord?.role === 'admin' ? 'ADMIN' : 'MEMBER';
  return { ...membership.runCrew, role };
});
```

**Gap Analysis:**
- ✅ Stores both arrays
- ✅ Combines them correctly
- ❌ **Two separate localStorage keys**
- ❌ **Must combine in multiple places** (athlete-home, CrewHero, etc.)
- ❌ **Inconsistent data** - managers array could be out of sync with memberships
- ❌ **Code duplication** - same merge logic in multiple files

---

## Complete Gap Inventory

### 1. Data Consistency Gaps

#### Gap 1.1: Orphaned Manager Records
**Problem:** A `RunCrewManager` record could exist without a corresponding `RunCrewMembership`.

**Scenario:**
- Database constraint violation or race condition
- Manual database manipulation
- Failed transaction rollback

**Impact:** 
- User appears as admin but has no membership
- Authorization checks could fail incorrectly
- Data integrity violation

**Location:** Anywhere we check roles without verifying membership first.

---

#### Gap 1.2: Missing Manager Records
**Problem:** A `RunCrewMembership` exists but no `RunCrewManager` record (for admins).

**Scenario:**
- `createCrew()` Step 3 fails (manager creation fails)
- Partial transaction failure
- Manual database manipulation

**Impact:**
- Admin loses admin status
- Cannot access admin features
- Data corruption

**Location:** `lib/domain-runcrew.ts::createCrew()` - no transaction wrapper.

---

#### Gap 1.3: Inconsistent State After Deletion
**Problem:** Deleting a membership doesn't automatically delete manager record (or vice versa).

**Current Schema:**
- `RunCrewMembership` has `onDelete: Cascade` from RunCrew/Athlete
- `RunCrewManager` has `onDelete: Cascade` from RunCrew/Athlete
- **BUT:** Deleting membership doesn't cascade to manager (they're separate tables!)

**Impact:**
- Orphaned manager records
- Orphaned membership records (if manager deleted first)

---

### 2. Query Performance Gaps

#### Gap 2.1: Multiple Database Queries
**Problem:** Every role check requires 2 queries (membership + manager).

**Locations:**
- `app/runcrew/[runCrewId]/admin/page.tsx` (lines 45-66)
- `app/api/me/run-crews/route.ts` (lines 67-86)
- `lib/domain-runcrew.ts::hydrateCrew()` (includes both relations)

**Impact:**
- 2x database round trips
- Slower response times
- Higher database load

---

#### Gap 2.2: In-Memory Array Joins
**Problem:** Must join two arrays in application code (O(n*m) complexity).

**Locations:**
- `lib/domain-athlete.ts::hydrateAthlete()` (lines 146-148)
- `app/api/me/run-crews/route.ts` (lines 89-104)
- `app/athlete-home/page.tsx` (lines 46-53)
- `components/athlete/CrewHero.tsx` (lines 47-54)

**Impact:**
- CPU overhead in application layer
- Code complexity
- Potential for bugs

---

#### Gap 2.3: Cannot Filter by Role in SQL
**Problem:** Cannot query "all admin memberships" in a single SQL query.

**Current:**
```typescript
// Must fetch all, then filter in code
const memberships = await prisma.runCrewMembership.findMany({ where: { athleteId } });
const managers = await prisma.runCrewManager.findMany({ where: { athleteId, role: 'admin' } });
// Then combine...
```

**Impact:**
- Cannot use database indexes for role filtering
- Must fetch all memberships even if we only want admins
- Inefficient for large datasets

---

### 3. Code Complexity Gaps

#### Gap 3.1: Duplicate Merge Logic
**Problem:** Same merge logic repeated in multiple files.

**Locations:**
1. `lib/domain-athlete.ts::hydrateAthlete()` (lines 146-154)
2. `app/api/me/run-crews/route.ts` (lines 89-104)
3. `app/athlete-home/page.tsx` (lines 46-53)
4. `components/athlete/CrewHero.tsx` (lines 47-54)
5. `lib/localstorage.ts::setFullHydrationModel()` (lines 115-119)

**Impact:**
- Code duplication (DRY violation)
- Harder to maintain
- Easy to introduce bugs
- Inconsistent implementations

---

#### Gap 3.2: Error-Prone Role Resolution
**Problem:** Easy to forget manager lookup or use wrong logic.

**Examples:**
- Forgetting to check manager record → all users appear as members
- Wrong comparison (`=== 'admin'` vs `=== 'ADMIN'`)
- Not handling null/undefined cases

**Impact:**
- Authorization bugs
- Security vulnerabilities
- User experience issues

---

#### Gap 3.3: Complex Hydration Logic
**Problem:** Hydration must include both relations and combine them.

**Example:**
```typescript
include: {
  runCrewMemberships: { include: { runCrew: { ... } } },
  runCrewManagers: { include: { runCrew: true } }  // Separate!
}
```

**Impact:**
- More complex Prisma queries
- Larger payloads (duplicate runCrew data)
- Harder to understand

---

### 4. LocalStorage Gaps

#### Gap 4.1: Two Separate Keys
**Problem:** Must store `runCrewMemberships` and `runCrewManagers` separately.

**Current:**
```typescript
localStorage.setItem('runCrewMemberships', JSON.stringify(memberships));
localStorage.setItem('runCrewManagers', JSON.stringify(managers));
```

**Impact:**
- More localStorage keys
- Larger storage footprint
- Must merge on every read

---

#### Gap 4.2: Synchronization Risk
**Problem:** Two arrays could get out of sync.

**Scenario:**
- Hydration updates memberships but not managers (partial update)
- Manual localStorage manipulation
- Browser storage corruption

**Impact:**
- Inconsistent UI state
- Wrong roles displayed
- Authorization failures

---

#### Gap 4.3: Multiple Merge Points
**Problem:** Must merge arrays in every component that needs roles.

**Locations:**
- `app/athlete-home/page.tsx`
- `components/athlete/CrewHero.tsx`
- Any future component that needs roles

**Impact:**
- Code duplication
- Performance overhead (repeated merges)
- Maintenance burden

---

### 5. Schema Design Gaps

#### Gap 5.1: Redundant Data Storage
**Problem:** `runCrewId + athleteId` stored in both tables.

**Impact:**
- Wasted storage space
- Data duplication
- Potential for inconsistency

---

#### Gap 5.2: No Single Source of Truth
**Problem:** Role information split across two tables.

**Impact:**
- Must query both to get complete picture
- No atomic updates
- Complex queries

---

#### Gap 5.3: Missing Constraints
**Problem:** No foreign key constraint ensuring manager record exists only if membership exists.

**Current:**
- Unique constraints on both tables
- Cascade deletes from RunCrew/Athlete
- **BUT:** No constraint linking the two tables

**Impact:**
- Can have manager without membership
- Can have membership without manager (for admins, this is wrong)
- Data integrity issues

---

## Refactoring Requirements

### Phase 1: Schema Migration

1. **Add `role` field to `RunCrewMembership`**
   ```prisma
   model RunCrewMembership {
     id        String @id @default(cuid())
     runCrewId String
     athleteId String
     role      String @default("member")  // NEW FIELD
     joinedAt  DateTime @default(now())
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     
     @@unique([runCrewId, athleteId])
     @@index([runCrewId, role])  // For filtering by role
     @@map("run_crew_memberships")
   }
   ```

2. **Create Migration Script**
   - Backfill existing memberships: set `role = 'member'` for all
   - Copy roles from `RunCrewManager` to `RunCrewMembership.role`
   - Verify data integrity

3. **Deprecate `RunCrewManager`**
   - Mark as deprecated (don't delete yet)
   - Stop writing to it
   - Keep for historical data

---

### Phase 2: Code Updates

#### Domain Functions
- [ ] `lib/domain-runcrew.ts::createCrew()` - Set `role: 'admin'` in membership
- [ ] `lib/domain-runcrew.ts::joinCrew()` - Set `role: 'member'` in membership
- [ ] `lib/domain-runcrew.ts::joinCrewById()` - Set `role: 'member'` in membership
- [ ] `lib/domain-runcrew.ts::hydrateCrew()` - Remove managers include, use membership.role
- [ ] `lib/domain-athlete.ts::hydrateAthlete()` - Remove runCrewManagers include, use membership.role

#### API Routes
- [ ] `app/api/me/run-crews/route.ts` - Use membership.role directly
- [ ] `app/api/athlete/hydrate/route.ts` - Already uses hydrateAthlete (will inherit fix)
- [ ] `app/api/runcrew/[id]/route.ts` - Check if uses roles (verify)
- [ ] `app/api/runcrew/hydrate/route.ts` - Check if uses roles (verify)

#### Pages
- [ ] `app/runcrew/[runCrewId]/admin/page.tsx` - Check membership.role directly
- [ ] `app/runcrew/[runCrewId]/member/page.tsx` - Check membership.role directly
- [ ] `app/athlete-home/page.tsx` - Use membership.role directly (no merge)
- [ ] `components/athlete/CrewHero.tsx` - Use membership.role directly (no merge)

#### LocalStorage
- [ ] `lib/localstorage.ts::setFullHydrationModel()` - Store role in membership (no separate managers array)
- [ ] `lib/localstorage.ts::getFullHydrationModel()` - Remove runCrewManagers key
- [ ] Update all localStorage readers to use membership.role

---

### Phase 3: Cleanup

1. **Remove RunCrewManager References**
   - Remove from schema (after migration period)
   - Remove from Prisma client
   - Update documentation

2. **Remove Merge Logic**
   - Delete all array merge code
   - Simplify hydration functions
   - Update tests

3. **Update Documentation**
   - Schema documentation
   - API documentation
   - Architecture docs

---

## Benefits of Refactoring

### 1. Data Consistency
- ✅ Single source of truth for membership + role
- ✅ Atomic updates (membership and role in one write)
- ✅ No orphaned records
- ✅ Foreign key constraints ensure integrity

### 2. Performance
- ✅ Single query for role checks
- ✅ Can filter by role in SQL
- ✅ Smaller payloads (no duplicate data)
- ✅ Database indexes for role filtering

### 3. Code Simplicity
- ✅ No merge logic needed
- ✅ Simpler queries
- ✅ Less code duplication
- ✅ Easier to understand

### 4. LocalStorage Efficiency
- ✅ Single array (memberships with embedded roles)
- ✅ No synchronization issues
- ✅ Smaller storage footprint
- ✅ Faster reads (no merge)

---

## Migration Risk Assessment

### Low Risk Areas
- ✅ Schema change is additive (adding field)
- ✅ Can backfill from existing RunCrewManager table
- ✅ Backward compatible during migration (both tables exist)

### Medium Risk Areas
- ⚠️ Code updates must be coordinated (all files updated together)
- ⚠️ LocalStorage structure changes (requires re-hydration)
- ⚠️ API response format changes (if clients cache responses)

### High Risk Areas
- ❌ Must update all code simultaneously (can't partially deploy)
- ❌ Database migration must run before code deploy
- ❌ Frontend must re-hydrate after migration (localStorage cleared)

---

## Recommended Migration Strategy

### Step 1: Schema Update (Deploy First)
1. Add `role` field to `RunCrewMembership` with default `"member"`
2. Create migration script to backfill from `RunCrewManager`
3. Deploy schema changes
4. Run migration script
5. Verify data integrity

### Step 2: Code Updates (Deploy Together)
1. Update all domain functions
2. Update all API routes
3. Update all pages/components
4. Update localStorage logic
5. Deploy all changes together (atomic deployment)

### Step 3: Verification
1. Test role checks (admin pages)
2. Test membership creation (create crew)
3. Test membership joining (join crew)
4. Test hydration (welcome page)
5. Verify localStorage structure

### Step 4: Cleanup (Later)
1. Mark `RunCrewManager` as deprecated
2. Stop writing to `RunCrewManager`
3. Remove from codebase (after verification period)
4. Drop table (optional, keep for audit)

---

## Summary

**Current State:**
- ❌ Dual junction tables (RunCrewMembership + RunCrewManager)
- ❌ Data duplication (runCrewId + athleteId in both)
- ❌ Multiple queries for role checks
- ❌ Manual array merges in code
- ❌ Complex hydration logic
- ❌ LocalStorage synchronization issues

**Target State:**
- ✅ Single junction table (RunCrewMembership with role field)
- ✅ No data duplication
- ✅ Single query for role checks
- ✅ No merge logic needed
- ✅ Simple hydration
- ✅ Single localStorage array

**Action Required:** Full refactor to consolidate into single junction table with `role` field.

