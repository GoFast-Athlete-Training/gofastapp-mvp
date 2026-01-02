# RunCrew Membership Role Analysis

**Date:** 2025-01-XX  
**Purpose:** Analyze current role handling and propose schema change to add `role` field to `RunCrewMembership`

---

## Current Schema Structure

### RunCrewMembership (Junction Table)
```prisma
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
```

**Current State:**
- ✅ Junction table for many-to-many relationship
- ❌ **NO role field** - role information stored separately
- ❌ Requires JOIN with `RunCrewManager` to determine role

### RunCrewManager (Separate Role Table)
```prisma
model RunCrewManager {
  id        String @id @default(cuid())
  runCrewId String
  athleteId String
  role      String  // "admin" or "manager"
  createdAt DateTime @default(now())

  runCrew RunCrew @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  athlete Athlete @relation("RunCrewManager", fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([runCrewId, athleteId])
  @@map("run_crew_managers")
}
```

**Current State:**
- ✅ Stores admin/manager roles
- ❌ Separate table requires JOIN for every role check
- ❌ Data duplication (runCrewId + athleteId in both tables)

---

## Current Role Resolution Pattern

### Pattern 1: Two-Step Query (Most Common)
```typescript
// Step 1: Get membership
const membership = await prisma.runCrewMembership.findUnique({
  where: { runCrewId_athleteId: { runCrewId, athleteId } }
});

// Step 2: Get role from separate table
const managerRecord = await prisma.runCrewManager.findUnique({
  where: { runCrewId_athleteId: { runCrewId, athleteId } }
});

// Step 3: Determine role
const role = managerRecord?.role === 'admin' ? 'ADMIN' : 'MEMBER';
```

**Used in:**
- `app/api/me/run-crews/route.ts` (lines 67-97)
- `app/runcrew/[runCrewId]/admin/page.tsx` (lines 59-68)
- `lib/domain-athlete.ts` (lines 146-151)

### Pattern 2: Include with Prisma Relations
```typescript
const athlete = await prisma.athlete.findUnique({
  where: { id: athleteId },
  include: {
    runCrewMemberships: { include: { runCrew: true } },
    runCrewManagers: true  // Separate relation
  }
});

// Then map in code:
const crews = athlete.runCrewMemberships.map((membership) => {
  const managerRole = athlete.runCrewManagers.find(
    m => m.runCrewId === membership.runCrewId
  );
  return {
    ...membership.runCrew,
    role: managerRole?.role || 'member'
  };
});
```

**Used in:**
- `lib/domain-athlete.ts` (lines 140-155)
- `app/athlete-home/page.tsx` (lines 42-63)

---

## Problems with Current Approach

### 1. **Query Complexity**
- Every role check requires JOIN or separate query
- Cannot filter memberships by role in single query
- More database round trips

### 2. **Data Duplication**
- `runCrewId` + `athleteId` stored in both tables
- Risk of inconsistent state (membership exists but manager record missing)

### 3. **Code Complexity**
- Every place that needs role must:
  1. Query membership
  2. Query manager record
  3. Combine in code
- Easy to introduce bugs (e.g., missing role check)

### 4. **Performance**
- Extra queries for role resolution
- Cannot use single index for role-based filtering
- More data transferred over network

### 5. **Frontend Hydration Complexity**
- Must hydrate both `runCrewMemberships` and `runCrewManagers`
- Must combine them in code before storing to localStorage
- More complex hydration logic

---

## Proposed Solution: Add `role` to RunCrewMembership

### New Schema
```prisma
model RunCrewMembership {
  id        String @id @default(cuid())
  runCrewId String
  athleteId String
  role      String  @default("member")  // "member" | "admin" | "manager"
  joinedAt  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  runCrew RunCrew @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  athlete Athlete @relation("AthleteRunCrewMemberships", fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([runCrewId, athleteId])
  @@index([runCrewId, role])  // For filtering crews by role
  @@map("run_crew_memberships")
}
```

### Benefits

1. **Simplified Queries**
   ```typescript
   // Single query with role
   const membership = await prisma.runCrewMembership.findUnique({
     where: { runCrewId_athleteId: { runCrewId, athleteId } }
   });
   const role = membership?.role || 'member';
   ```

2. **Direct Filtering**
   ```typescript
   // Get all admin memberships in one query
   const adminMemberships = await prisma.runCrewMembership.findMany({
     where: { runCrewId, role: 'admin' }
   });
   ```

3. **Simplified Hydration**
   ```typescript
   const athlete = await prisma.athlete.findUnique({
     where: { id: athleteId },
     include: {
       runCrewMemberships: {
         include: { runCrew: true }
       }
     }
   });
   // Role already in membership, no mapping needed
   ```

4. **Data Consistency**
   - Single source of truth for membership + role
   - Cannot have membership without role
   - Easier to enforce constraints

5. **Better Performance**
   - Single table query
   - Indexed role field for fast filtering
   - Less data transfer

---

## Migration Strategy

### Phase 1: Add Field (Backward Compatible)
1. Add `role` field with default `"member"`
2. Create migration to backfill existing memberships:
   ```sql
   -- Set all existing memberships to 'member'
   UPDATE run_crew_memberships SET role = 'member' WHERE role IS NULL;
   
   -- Backfill from RunCrewManager table
   UPDATE run_crew_memberships m
   SET role = rm.role
   FROM run_crew_managers rm
   WHERE m.runCrewId = rm.runCrewId
     AND m.athleteId = rm.athleteId;
   ```

### Phase 2: Update Code
1. Update all queries to use `membership.role` directly
2. Remove `RunCrewManager` queries from role resolution
3. Update hydration logic to use membership role

### Phase 3: Deprecate RunCrewManager
1. Mark `RunCrewManager` table as deprecated
2. Remove writes to `RunCrewManager` for new memberships
3. Keep table for historical data (optional)

---

## Files That Need Updates

### Schema Files
- ✅ `packages/shared-db/prisma/schema.prisma` - Add `role` field

### Domain Logic
- `lib/domain-runcrew.ts`
  - `createCrew()` - Set creator role to 'admin' in membership
  - `joinCrew()` - Set new member role to 'member' in membership
  - `hydrateCrew()` - Remove RunCrewManager join

### API Routes
- `app/api/me/run-crews/route.ts` - Use membership.role directly
- `app/api/runcrew/[id]/route.ts` - Update role checks
- `app/api/athlete/hydrate/route.ts` - Include role in response

### Domain Functions
- `lib/domain-athlete.ts`
  - `hydrateAthlete()` - Remove RunCrewManager mapping logic

### Pages/Components
- `app/athlete-home/page.tsx` - Use membership.role directly
- `app/runcrew/[runCrewId]/admin/page.tsx` - Check membership.role
- `app/runcrew/[runCrewId]/member/page.tsx` - Check membership.role
- `components/athlete/CrewHero.tsx` - Remove manager role lookup

### LocalStorage
- `lib/localstorage.ts` - Update hydration model structure (role already in membership)

---

## Role Values

### Proposed Enum Values
- `"member"` - Default role, regular crew member
- `"admin"` - Crew administrator (full permissions)
- `"manager"` - Crew manager (limited admin permissions, future use)

### Default Behavior
- New memberships: `role = "member"`
- Crew creator: `role = "admin"`
- Existing members: Backfill from `RunCrewManager` table

---

## Questions to Consider

1. **RunCrewManager Table**
   - Should we delete it entirely?
   - Or keep for historical/audit purposes?
   - Recommendation: Keep for now, mark as deprecated

2. **Role Granularity**
   - Do we need "manager" role now?
   - Or just "member" and "admin"?
   - Recommendation: Add all three for future-proofing

3. **Migration Safety**
   - Should we run both systems in parallel during migration?
   - Or migrate all at once?
   - Recommendation: Migrate all at once with backfill script

4. **API Backward Compatibility**
   - Should API continue to return separate `runCrewManagers` array?
   - Or remove it entirely?
   - Recommendation: Remove it, role is now in membership

---

## Implementation Checklist

- [ ] Add `role` field to `RunCrewMembership` schema
- [ ] Create migration script to backfill roles
- [ ] Update `createCrew()` to set creator role = 'admin'
- [ ] Update `joinCrew()` to set new member role = 'member'
- [ ] Update `hydrateAthlete()` to remove RunCrewManager mapping
- [ ] Update all API routes to use membership.role
- [ ] Update all pages to check membership.role
- [ ] Update localStorage hydration logic
- [ ] Test role-based access control
- [ ] Document deprecated RunCrewManager table
- [ ] Create rollback plan

---

## Summary

**Current State:** Roles stored in separate `RunCrewManager` table, requiring JOINs and complex queries.

**Proposed State:** Add `role` field directly to `RunCrewMembership` table, simplifying queries and improving performance.

**Benefits:** Simpler code, better performance, data consistency, easier maintenance.

**Migration Risk:** Low - backward compatible with default value, can backfill from existing RunCrewManager table.

