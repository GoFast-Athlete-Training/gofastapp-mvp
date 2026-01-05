# Prisma Relation Names - The Real Issue

**Date:** January 5, 2025  
**Problem:** Code uses camelCase relation names but schema uses snake_case model names

---

## The Core Problem

**Prisma generates relation names based on the MODEL NAME, not a custom relation name.**

### How Prisma Works:

1. **Model Name** → **Prisma Client Property**
   - `model run_crews` → `prisma.run_crews` (snake_case)
   - `model run_crew_memberships` → `prisma.run_crew_memberships` (snake_case)

2. **Relation Field Name** → **Access in Queries**
   - If model is `run_crews` and relation is `run_crew_memberships`, you access it as `run_crew_memberships` (not `memberships`)

---

## Current Schema Pattern

```prisma
model run_crews {
  id                      String                    @id @default(cuid())
  // ...
  run_crew_memberships    run_crew_memberships[]   // Relation name = model name
  run_crew_messages       run_crew_messages[]       // Relation name = model name
  run_crew_announcements  run_crew_announcements[] // Relation name = model name
  run_crew_runs           run_crew_runs[]          // Relation name = model name
  join_codes              join_codes[]             // Relation name = model name
}
```

**Result:** All relation names are snake_case because model names are snake_case.

---

## What Code Was Expecting (WRONG)

```typescript
// ❌ WRONG - Code was using camelCase
crew.memberships
crew.messages
crew.announcements
crew.runs
crew.joinCodes
```

---

## What Code Should Use (CORRECT)

```typescript
// ✅ CORRECT - Use snake_case matching model names
crew.run_crew_memberships
crew.run_crew_messages
crew.run_crew_announcements
crew.run_crew_runs
crew.join_codes
```

---

## The Fix: Two Options

### Option 1: Keep Snake_Case (Current - What We're Doing)

**Pros:**
- Matches database table names
- No schema changes needed
- Consistent with existing migrations

**Cons:**
- Ugly in TypeScript code (`crew.run_crew_memberships`)
- Inconsistent with TypeScript naming conventions

**Code Pattern:**
```typescript
const crew = await prisma.run_crews.findUnique({
  where: { id },
  include: {
    run_crew_memberships: { ... },  // snake_case
    run_crew_messages: { ... },     // snake_case
  }
});

// Access:
crew.run_crew_memberships  // snake_case
```

---

### Option 2: Use PascalCase Models with @@map (Better for TypeScript)

**Pros:**
- Clean TypeScript code (`crew.memberships`)
- Follows TypeScript naming conventions
- Better developer experience

**Cons:**
- Requires schema refactor
- Need to update all relation names
- Migration complexity

**Schema Pattern:**
```prisma
model RunCrew {
  id          String  @id @default(cuid())
  // ...
  memberships RunCrewMembership[]  // Clean camelCase relation
  messages    RunCrewMessage[]     // Clean camelCase relation
  
  @@map("run_crews")  // Maps to snake_case table name
}

model RunCrewMembership {
  id        String   @id @default(cuid())
  runCrewId String
  runCrew   RunCrew  @relation(fields: [runCrewId], references: [id])
  
  @@map("run_crew_memberships")  // Maps to snake_case table name
}
```

**Code Pattern:**
```typescript
const crew = await prisma.runCrew.findUnique({  // PascalCase model
  where: { id },
  include: {
    memberships: { ... },  // Clean camelCase
    messages: { ... },     // Clean camelCase
  }
});

// Access:
crew.memberships  // Clean camelCase
```

---

## Why This Happened

1. **Legacy Schema:** Original schema used snake_case model names (matching database)
2. **Code Assumptions:** Code was written assuming camelCase relation names
3. **Prisma Behavior:** Prisma uses model name as relation name (not customizable without @@relation name)
4. **Mismatch:** Snake_case models → snake_case relations → code breaks

---

## Current Status

**We're fixing it by:**
- ✅ Using snake_case relation names everywhere (`run_crew_memberships`, `run_crew_messages`, etc.)
- ✅ Updating all code to match schema
- ✅ Keeping `@default(cuid())` pattern (like Ignite project)

**Files Fixed:**
- ✅ `lib/domain-runcrew.ts` - Updated all relation names
- ✅ `lib/domain-athlete.ts` - Updated all relation names
- ✅ `app/api/me/run-crews/route.ts` - Updated relation names

---

## Recommendation

**Short Term:** Keep snake_case, fix all code to match (what we're doing now)

**Long Term:** Consider refactoring to PascalCase models with `@@map` for better TypeScript experience:
- Better code readability
- Follows TypeScript conventions
- Easier to maintain

But this requires:
- Schema refactor
- Migration of all relation references
- Testing all queries

**For now:** Fix the immediate issues with snake_case, document the pattern, and consider refactor later.

---

## Relation Name Reference

| Model Name (Schema) | Prisma Client | Relation Name in Queries |
|---------------------|---------------|--------------------------|
| `run_crews` | `prisma.run_crews` | `run_crews` |
| `run_crew_memberships` | `prisma.run_crew_memberships` | `run_crew_memberships` |
| `run_crew_messages` | `prisma.run_crew_messages` | `run_crew_messages` |
| `run_crew_announcements` | `prisma.run_crew_announcements` | `run_crew_announcements` |
| `run_crew_runs` | `prisma.run_crew_runs` | `run_crew_runs` |
| `run_crew_run_rsvps` | `prisma.run_crew_run_rsvps` | `run_crew_run_rsvps` |
| `join_codes` | `prisma.join_codes` | `join_codes` |
| `Athlete` | `prisma.athlete` | `Athlete` (capitalized - relation name) |

**Note:** `Athlete` is capitalized because it's the relation name in the schema, not the model name.

---

**Bottom Line:** Prisma uses the MODEL NAME as the relation name. If models are snake_case, relations are snake_case. Code must match.

