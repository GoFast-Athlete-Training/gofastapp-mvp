# RunCrew Event RSVP Analysis

**Date:** 2025-01-XX  
**Purpose:** Investigate RSVP capability for RunCrew Events with param-based procedure

**Important Context:** Events are **NOT implemented for MVP1** - only Runs have RSVP functionality. This analysis is for future reference when events are added.

---

## Current State Summary

### ✅ What Exists

1. **Database Schema** - `run_crew_event_rsvps` table exists
   - Primary Key: `id` (String) - **⚠️ ISSUE: Missing `@default(cuid())`**
   - Foreign Key: `eventId` → `run_crew_events.id`
   - Foreign Key: `athleteId` → `Athlete.id`
   - Status: `String` (should be: "going" | "maybe" | "not-going")
   - Unique Constraint: `[eventId, athleteId]` (one RSVP per athlete per event)
   - Cascade Delete: On event or athlete deletion

2. **Run RSVP Implementation** (for reference)
   - ✅ Domain Function: `rsvpToRun()` in `lib/domain-runcrew.ts`
   - ✅ API Route: `POST /api/runcrew/[id]/runs/[runId]/rsvp`
   - ✅ Follows param-based procedure pattern

### ❌ What's Missing (Expected - Not Part of MVP1)

1. **Domain Function** - No `rsvpToEvent()` function (events not in MVP1)
2. **API Route** - No `POST /api/runcrew/[id]/events/[eventId]/rsvp` route (events not in MVP1)
3. **Schema Fix** - ✅ **FIXED**: `run_crew_event_rsvps.id` now has `@default(cuid())`

**Note:** The `createEvent()` function in `lib/domain-runcrew.ts` currently throws an error: "Events are deprecated for MVP1"

---

## Data Model Structure

### RunCrewEventRSVP Relationship

```
RunCrewEvent (one event)
    ↓ (has many)
RunCrewEventRSVP[] (many RSVPs)
    ↓ (each RSVP has)
Athlete (one athlete per RSVP)
```

**Key Relationship:**
- **One Event** can have **Many RSVPs**
- **One Athlete** can have **One RSVP per Event** (enforced by unique constraint)
- RSVP expresses the athlete's **intent** (going/maybe/not-going) to attend a specific event

### Foreign Key Structure

```prisma
model run_crew_event_rsvps {
  id              String          @id @default(cuid())  // ⚠️ NEEDS FIX
  eventId         String          // FK → run_crew_events.id
  athleteId       String          // FK → Athlete.id
  status          String          // "going" | "maybe" | "not-going"
  createdAt       DateTime        @default(now())
  
  Athlete         Athlete         @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  run_crew_events run_crew_events @relation(fields: [eventId], references: [id], onDelete: Cascade)
  
  @@unique([eventId, athleteId])  // One RSVP per athlete per event
}
```

**Answer to User's Question:**
> "so the member sees the runcrewevent and basically authors by athleteid their intent so is its a foreign key to that one run?"

**Yes, exactly!** The RSVP is:
- **Authored by**: `athleteId` (the member expressing intent)
- **Foreign Key to**: `eventId` (the specific event)
- **Expresses**: `status` (intent: going/maybe/not-going)
- **Unique**: One RSVP per athlete per event (composite unique constraint)

---

## Comparison: Run RSVP vs Event RSVP

### Run RSVP (✅ Complete)

| Component | Status | Location |
|-----------|--------|----------|
| Domain Function | ✅ `rsvpToRun()` | `lib/domain-runcrew.ts:998` |
| API Route | ✅ `POST /api/runcrew/[id]/runs/[runId]/rsvp` | `app/api/runcrew/[id]/runs/[runId]/rsvp/route.ts` |
| Schema Table | ✅ `run_crew_run_rsvps` | `prisma/schema.prisma:272` |
| Schema ID Default | ✅ `@default(cuid())` | Line 273 |

### Event RSVP (❌ Incomplete)

| Component | Status | Location |
|-----------|--------|----------|
| Domain Function | ❌ Missing | Should be in `lib/domain-runcrew.ts` |
| API Route | ❌ Missing | Should be `app/api/runcrew/[id]/events/[eventId]/rsvp/route.ts` |
| Schema Table | ✅ `run_crew_event_rsvps` | `prisma/schema.prisma:215` |
| Schema ID Default | ❌ Missing `@default(cuid())` | Line 216 - **NEEDS FIX** |

---

## Param-Based Procedure Pattern

The current implementation follows this pattern:

### For Runs (Reference Implementation)

**Route:** `POST /api/runcrew/[id]/runs/[runId]/rsvp`

**Flow:**
1. Extract params: `{ id: runCrewId, runId }` from route
2. Authenticate: Firebase token → Athlete
3. Authorize: Verify membership via `hydrateCrew(id)` → check `membershipsBox`
4. Validate: Verify run exists and belongs to crew
5. Execute: Call `rsvpToRun({ runId, athleteId, status })`
6. Return: RSVP object with athlete data

### For Events (Needed Implementation)

**Route:** `POST /api/runcrew/[id]/events/[eventId]/rsvp`

**Should Follow Same Pattern:**
1. Extract params: `{ id: runCrewId, eventId }` from route
2. Authenticate: Firebase token → Athlete
3. Authorize: Verify membership via `hydrateCrew(id)` → check `membershipsBox`
4. Validate: Verify event exists and belongs to crew
5. Execute: Call `rsvpToEvent({ eventId, athleteId, status })`
6. Return: RSVP object with athlete data

---

## Required Implementation

### 1. Fix Schema (CRITICAL)

**File:** `prisma/schema.prisma`

```prisma
model run_crew_event_rsvps {
  id              String          @id @default(cuid())  // ADD @default(cuid())
  eventId         String
  athleteId       String
  status          String
  createdAt       DateTime        @default(now())
  Athlete         Athlete         @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  run_crew_events run_crew_events @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([eventId, athleteId])
}
```

**Migration Required:** Yes (add default to id field)

### 2. Add Domain Function

**File:** `lib/domain-runcrew.ts`

Add after `rsvpToRun()` function:

```typescript
/**
 * RSVP to an event
 */
export async function rsvpToEvent(data: {
  eventId: string;
  athleteId: string;
  status: 'going' | 'maybe' | 'not-going';
}) {
  const rsvp = await prisma.run_crew_event_rsvps.upsert({
    where: {
      eventId_athleteId: {
        eventId: data.eventId,
        athleteId: data.athleteId,
      },
    },
    update: {
      status: data.status,
    },
    create: {
      id: cuid(), // Or rely on @default(cuid()) after schema fix
      eventId: data.eventId,
      athleteId: data.athleteId,
      status: data.status,
    },
    include: {
      Athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoURL: true,
        },
      },
    },
  });

  return rsvp;
}
```

### 3. Create API Route

**File:** `app/api/runcrew/[id]/events/[eventId]/rsvp/route.ts`

```typescript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { hydrateCrew, rsvpToEvent } from '@/lib/domain-runcrew';

// POST /api/runcrew/[id]/events/[eventId]/rsvp - RSVP to an event
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const { id, eventId } = await params;
    if (!id || !eventId) {
      return NextResponse.json({ error: 'Missing crew id or event id' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const { status } = body;
    if (!status || !['going', 'maybe', 'not-going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be going, maybe, or not-going' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;

    let athlete;
    try {
      athlete = await getAthleteByFirebaseId(firebaseId);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Verify user is a member of the crew
    let crew;
    try {
      crew = await hydrateCrew(id);
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    const membership = crew.membershipsBox?.memberships?.find(
      (m: any) => m.athleteId === athlete.id
    );
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden - Must be a member' }, { status: 403 });
    }

    // Verify event exists and belongs to this crew
    // NOTE: Events are not currently in hydrateCrew, so we need to query directly
    // OR add events to hydrateCrew (future enhancement)
    const event = await prisma.run_crew_events.findFirst({
      where: {
        id: eventId,
        runCrewId: id,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Create or update RSVP
    let rsvp;
    try {
      rsvp = await rsvpToEvent({
        eventId,
        athleteId: athlete.id,
        status: status as 'going' | 'maybe' | 'not-going',
      });
    } catch (err) {
      console.error('Prisma error:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, rsvp });
  } catch (err) {
    console.error('Error RSVPing to event:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

---

## Key Findings

1. ✅ **Database Schema Structure is Correct**
   - Foreign key relationship is properly defined
   - Unique constraint ensures one RSVP per athlete per event
   - Cascade deletes are properly configured

2. ⚠️ **Schema Issue: Missing ID Default**
   - `run_crew_event_rsvps.id` needs `@default(cuid())`
   - This will cause errors when creating RSVPs without explicit ID

3. ❌ **Missing Implementation**
   - No domain function for event RSVP
   - No API route for event RSVP
   - Pattern should match run RSVP implementation

4. ✅ **Param-Based Procedure is Correct**
   - Route params: `[id]` (runCrewId) and `[eventId]`
   - Authentication via Firebase token
   - Authorization via membership check
   - Follows same pattern as run RSVP

---

## Recommendation (For Future Implementation)

**Current Status:** Events are NOT part of MVP1. Only Runs have RSVP functionality.

When implementing events in the future:

1. ✅ **Schema fix complete** - `run_crew_event_rsvps.id` now has `@default(cuid())` (fixed for downstream work)
2. **Create/run migration** for schema change (when ready to deploy)
3. **Implement domain function** `rsvpToEvent()` (mirror `rsvpToRun()`)
4. **Create API route** following param-based pattern
5. **Update `createEvent()`** to actually create events (currently throws error)
6. **Test** event RSVP functionality end-to-end

---

## Notes

- **Events are NOT part of MVP1** - only Runs are implemented
- Events are currently **not included** in `hydrateCrew()`, so event validation in API route needs direct Prisma query
- Consider adding events to `hydrateCrew()` in the future for consistency
- Event RSVP follows exact same pattern as Run RSVP - just different table/foreign key
- The `createEvent()` function currently throws "Events are deprecated for MVP1" error
- This analysis serves as a reference for future event RSVP implementation

