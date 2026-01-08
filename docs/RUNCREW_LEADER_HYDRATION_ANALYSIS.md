# RunCrew Leader Hydration Analysis

**Date**: January 2025  
**Issue**: Inconsistent/double hydration pattern for leader info in public metadata

---

## Problem Statement

When fetching public RunCrew metadata by handle, we need to display:
- Crew name, description, city, purpose, paces (✅ working)
- Leader name and bio (❌ problematic)

**Current Approach (Broken)**:
```typescript
// Step 1: Get crew by handle
const crew = await prisma.run_crews.findUnique({ where: { handle } });

// Step 2: Secondary query to get leader
const adminManager = await prisma.run_crew_managers.findFirst({
  where: { runCrewId: crew.id, role: 'admin' },
  include: { Athlete: { select: { firstName, lastName, bio } } }
});
```

**Issues**:
1. **Double hydration**: Two separate database queries instead of one
2. **API endpoint architecture**: This is an API route, not a client-side component - we shouldn't be making secondary calls
3. **Inconsistent pattern**: Other crew data comes in one response, leader requires a second call
4. **Error handling complexity**: If leader query fails, we still return crew data but without leader info (inconsistent state)

---

## Root Cause Analysis

### The Real Issue

The problem isn't the database query itself - it's the **API architecture pattern**:

1. **Public API Endpoint**: `/api/runcrew/public/handle/[handle]`
   - Should return ALL public data in ONE response
   - Client expects complete data, not partial + secondary calls

2. **Hydration Pattern Mismatch**:
   - We're treating this like client-side hydration (multiple calls)
   - But it's a server-side API endpoint (should be single response)

3. **Foreign Key Resolution**:
   - Leader is stored in `run_crew_managers` table (junction table)
   - Foreign key: `runCrewId` → `run_crews.id`
   - Foreign key: `athleteId` → `athletes.id`
   - We need to resolve: `runCrewId` → find admin manager → get athlete details

---

## Solution: Single Query with Proper Relation

### Option 1: Include Relation in Main Query (Recommended)

```typescript
export async function getCrewPublicMetadataByHandle(handle: string) {
  const crew = await prisma.run_crews.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      id: true,
      handle: true,
      name: true,
      description: true,
      logo: true,
      icon: true,
      joinCode: true,
      city: true,
      state: true,
      easyMilesPace: true,
      crushingItPace: true,
      purpose: true,
      // Include leader via relation
      run_crew_managers: {
        where: { role: 'admin' },
        take: 1,
        select: {
          Athlete: {
            select: {
              firstName: true,
              lastName: true,
              bio: true,
            },
          },
        },
      },
    },
  });

  if (!crew) {
    return null;
  }

  // Extract leader from relation (single query result)
  const leader = crew.run_crew_managers?.[0]?.Athlete;

  return {
    id: crew.id,
    handle: crew.handle,
    name: crew.name,
    description: crew.description,
    logo: crew.logo,
    icon: crew.icon,
    joinCode: crew.joinCode,
    city: crew.city,
    state: crew.state,
    easyMilesPace: crew.easyMilesPace,
    crushingItPace: crew.crushingItPace,
    purpose: crew.purpose,
    leader: leader ? {
      name: `${leader.firstName || ''} ${leader.lastName || ''}`.trim() || 'RunCrew Leader',
      bio: leader.bio || null,
    } : null,
  };
}
```

**Benefits**:
- ✅ Single database query
- ✅ Single API response
- ✅ Consistent hydration pattern
- ✅ All public data in one place

**Potential Issues**:
- Nested relation query might fail if relation is misconfigured
- Need to verify Prisma relation name (`Athlete` vs `athlete`)

---

### Option 2: Denormalize Leader Info (Future Optimization)

If leader info becomes a performance bottleneck, we could:
1. Add `leaderName` and `leaderBio` fields directly to `run_crews` table
2. Update these fields when admin changes
3. Trade-off: Denormalization vs. consistency

**Not recommended now** - adds complexity and potential data inconsistency.

---

## Current State (Temporary)

**Removed leader query for now** to avoid breaking the API endpoint.

**What's missing**:
- Leader name/bio on front door page
- "Led by {name}" section in expandable details

**Next Steps**:
1. Verify Prisma relation configuration
2. Test nested relation query in isolation
3. Re-add leader info using Option 1 (single query with relation)
4. Ensure error handling if no leader exists

---

## Database Schema Reference

```prisma
model run_crews {
  id                      String                    @id @default(cuid())
  handle                  String                    @unique
  name                    String
  // ... other fields
  
  run_crew_managers       run_crew_managers[]
}

model run_crew_managers {
  id        String    @id
  runCrewId String
  athleteId String
  role      String
  Athlete   Athlete   @relation(fields: [athleteId], references: [id])
  run_crews run_crews @relation(fields: [runCrewId], references: [id])
}

model Athlete {
  id        String                @id @default(cuid())
  firstName String?
  lastName  String?
  bio       String?
  // ... other fields
}
```

**Key Relations**:
- `run_crews.run_crew_managers` → array of managers
- `run_crew_managers.Athlete` → athlete details (capital A - Prisma relation name)

---

## Testing Checklist

When re-implementing leader hydration:

- [ ] Verify Prisma relation name is `Athlete` (capital A)
- [ ] Test query with crew that has admin
- [ ] Test query with crew that has no admin
- [ ] Test query with crew that has multiple admins (should take first)
- [ ] Verify API response includes leader or null
- [ ] Test front door page displays leader info correctly
- [ ] Verify no secondary database queries in network tab

---

## Related Files

- `lib/domain-runcrew.ts` - `getCrewPublicMetadataByHandle()`
- `app/api/runcrew/public/handle/[handle]/route.ts` - API endpoint
- `app/join/runcrew/[handle]/page.tsx` - Front door page (consumes API)

---

## Summary

**Problem**: Double hydration pattern (two queries) breaks API architecture  
**Solution**: Single query with nested relation to include leader in main response  
**Status**: Leader query removed temporarily, needs proper implementation  
**Priority**: Medium - Leader info is nice-to-have, not critical for MVP

