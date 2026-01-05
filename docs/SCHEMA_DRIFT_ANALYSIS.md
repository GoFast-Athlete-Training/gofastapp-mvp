# Schema Drift Analysis - Critical Issues

**Date:** January 5, 2025  
**Status:** 🔴 **CRITICAL - Schema Inconsistencies Detected**

---

## Executive Summary

The schema has **inconsistent patterns** that are causing TypeScript compilation errors and potential runtime issues. This is causing "schema drift" where the Prisma-generated types don't match what the code expects.

---

## Critical Issues Found

### 1. Missing `@default(cuid())` on ID Fields

**Problem:** Several models have `@id` without `@default(cuid())`, causing Prisma to require manual ID generation.

**Affected Models:**
- ✅ `Athlete` - Has `@id @default(cuid())` ✅
- ❌ `run_crews` - **MISSING** `@default(cuid())` (just fixed)
- ❌ `run_crew_memberships` - **MISSING** `@default(cuid())`
- ❌ `run_crew_messages` - **MISSING** `@default(cuid())`
- ❌ `run_crew_announcements` - **MISSING** `@default(cuid())`
- ❌ `run_crew_runs` - **MISSING** `@default(cuid())`
- ❌ `run_crew_events` - **MISSING** `@default(cuid())`
- ❌ Many other models...

**Impact:**
- TypeScript errors: "Property 'id' is missing"
- Runtime errors when creating records
- Inconsistent with other models

---

### 2. Missing `@updatedAt` Decorator

**Problem:** Some models have `updatedAt DateTime` without `@updatedAt`, requiring manual updates.

**Affected Models:**
- ✅ `Athlete` - Has `@updatedAt` ✅
- ✅ `run_crews` - Has `@updatedAt` ✅ (just fixed)
- ❌ `run_crew_memberships` - Has `updatedAt DateTime` but **MISSING** `@updatedAt`
- ❌ Many other models...

**Impact:**
- `updatedAt` field won't auto-update
- Inconsistent behavior across models

---

### 3. Model Naming Inconsistency

**Problem:** Schema uses snake_case (`run_crews`, `run_crew_memberships`) but code sometimes expects camelCase (`runCrew`, `runCrewMemberships`).

**Current State:**
- Schema: `model run_crews` (snake_case)
- Prisma generates: `prisma.run_crews` (snake_case)
- Code sometimes uses: `runCrew` (camelCase) ❌

**Impact:**
- TypeScript errors: "Property 'runCrew' does not exist"
- Confusion about correct relation names
- Need to use `run_crews` everywhere

---

### 4. Relation Name Inconsistencies

**Problem:** Relation names in schema don't match what Prisma generates.

**Examples:**
- Schema: `Athlete @relation(...)` → Prisma generates: `Athlete` (capitalized)
- Schema: `run_crews @relation(...)` → Prisma generates: `run_crews` (snake_case)
- Code was using: `runCrew` (camelCase) ❌

**Fixed:**
- ✅ Changed `runCrew` → `run_crews` in code
- ✅ Changed `company` → `goFastCompany` in code
- ✅ Changed `runCrewMemberships` → `run_crew_memberships` in code

---

## Root Cause Analysis

### Why This Happened:

1. **Legacy Schema:** The schema was migrated from an older system with inconsistent patterns
2. **Incremental Changes:** We've been adding fields without standardizing the base model
3. **Mixed Conventions:** Some models follow best practices, others don't
4. **No Schema Audit:** We haven't done a comprehensive review of all models

---

## Immediate Fixes Needed

### Priority 1: Fix ID Defaults

**Action:** Add `@default(cuid())` to all `@id` fields missing it.

**Models to Fix:**
```prisma
model run_crew_memberships {
  id String @id @default(cuid())  // ADD THIS
  // ...
}

model run_crew_messages {
  id String @id @default(cuid())  // ADD THIS
  // ...
}

model run_crew_announcements {
  id String @id @default(cuid())  // ADD THIS
  // ...
}

// ... and all other models
```

### Priority 2: Fix updatedAt Decorators

**Action:** Add `@updatedAt` to all `updatedAt DateTime` fields.

**Models to Fix:**
```prisma
model run_crew_memberships {
  updatedAt DateTime @updatedAt  // ADD @updatedAt
  // ...
}
```

### Priority 3: Standardize Model Names

**Decision Needed:** 
- Option A: Keep snake_case (`run_crews`) - **Current**
- Option B: Switch to PascalCase (`RunCrew`) - **Requires migration**

**Recommendation:** Keep snake_case for now, but be consistent everywhere.

---

## Schema Standardization Checklist

For every model, ensure:

- [ ] `id String @id @default(cuid())`
- [ ] `createdAt DateTime @default(now())`
- [ ] `updatedAt DateTime @updatedAt`
- [ ] Consistent naming convention (snake_case or PascalCase)
- [ ] Relation names match Prisma-generated names

---

## Files That Need Updates

1. **`prisma/schema.prisma`**
   - Add `@default(cuid())` to all missing ID fields
   - Add `@updatedAt` to all missing updatedAt fields
   - Audit all models for consistency

2. **`lib/domain-runcrew.ts`**
   - ✅ Fixed: Using `run_crews` instead of `runCrew`
   - ✅ Fixed: Using `run_crew_memberships` instead of `runCrewMemberships`
   - ⚠️ Need to verify all relation names

3. **`lib/domain-athlete.ts`**
   - ✅ Fixed: Using `run_crew_memberships` instead of `runCrewMemberships`
   - ✅ Fixed: Using `goFastCompany` instead of `company`
   - ✅ Fixed: Using `run_crews` instead of `runCrew`
   - ✅ Fixed: Using `Athlete` (capitalized) for relation

4. **`app/api/me/run-crews/route.ts`**
   - ✅ Fixed: Using `run_crews` instead of `runCrew`

---

## Recommended Action Plan

### Phase 1: Emergency Fixes (Now)
1. Add `@default(cuid())` to `run_crew_memberships.id`
2. Add `@updatedAt` to `run_crew_memberships.updatedAt`
3. Run `prisma generate` and test build

### Phase 2: Schema Audit (This Week)
1. Create script to check all models for:
   - Missing `@default(cuid())` on IDs
   - Missing `@updatedAt` on updatedAt fields
   - Inconsistent naming
2. Fix all issues found
3. Create migration to update database

### Phase 3: Documentation (Next Week)
1. Document schema conventions
2. Add pre-commit hook to check schema consistency
3. Create schema review checklist

---

## Current Build Errors

1. ❌ `run_crew_memberships.create()` - Missing `id` and `updatedAt` in type
2. ✅ `run_crews.create()` - Fixed by adding `@default(cuid())`
3. ✅ Relation name errors - Fixed by using correct names

---

## Prevention Strategy

1. **Schema Linting:** Add pre-commit hook to validate schema patterns
2. **Code Review:** Always check schema changes for consistency
3. **Documentation:** Keep schema conventions documented
4. **Automated Checks:** Run `prisma validate` and `prisma format` before commits

---

**Next Steps:** Fix `run_crew_memberships` model immediately, then audit all other models.

