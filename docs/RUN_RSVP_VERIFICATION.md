# Run RSVP Verification

**Date:** 2025-01-XX  
**Purpose:** Verify Run RSVP implementation with param-based procedure

---

## ✅ Verification Summary

**Status:** ✅ **CORRECTLY IMPLEMENTED**

The Run RSVP functionality is properly implemented using the param-based procedure pattern.

---

## Implementation Details

### 1. Database Schema ✅

**Table:** `run_crew_run_rsvps`

```prisma
model run_crew_run_rsvps {
  id            String        @id @default(cuid())  // ✅ Has default
  runId         String        // FK → run_crew_runs.id
  athleteId     String        // FK → Athlete.id
  status        String        // "going" | "maybe" | "not-going"
  createdAt     DateTime      @default(now())
  Athlete       Athlete       @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  run_crew_runs run_crew_runs @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@unique([runId, athleteId])  // ✅ One RSVP per athlete per run
}
```

**Key Points:**
- ✅ `id` has `@default(cuid())` - no issues creating RSVPs
- ✅ Foreign key to `run_crew_runs.id` (the specific run)
- ✅ Foreign key to `Athlete.id` (the member expressing intent)
- ✅ Unique constraint ensures one RSVP per athlete per run
- ✅ Cascade delete on run or athlete deletion

---

### 2. Domain Function ✅

**File:** `lib/domain-runcrew.ts:1006`

```typescript
export async function rsvpToRun(data: {
  runId: string;
  athleteId: string;
  status: 'going' | 'maybe' | 'not-going';
}) {
  const rsvp = await prisma.run_crew_run_rsvps.upsert({
    where: {
      runId_athleteId: {  // ✅ Uses unique constraint correctly
        runId: data.runId,
        athleteId: data.athleteId,
      },
    },
    update: {
      status: data.status,  // ✅ Updates existing RSVP
    },
    create: {
      runId: data.runId,
      athleteId: data.athleteId,
      status: data.status,  // ✅ Creates new RSVP
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

**Key Points:**
- ✅ Uses `upsert` - creates or updates RSVP
- ✅ Uses correct unique constraint name: `runId_athleteId`
- ✅ Returns RSVP with athlete data included
- ✅ Handles both create and update scenarios

---

### 3. API Route ✅

**File:** `app/api/runcrew/[id]/runs/[runId]/rsvp/route.ts`

**Route:** `POST /api/runcrew/[id]/runs/[runId]/rsvp`

**Param-Based Procedure Flow:**

1. ✅ **Extract Params** - `{ id: runCrewId, runId }` from route params
   ```typescript
   const { id, runId } = await params;
   ```

2. ✅ **Authenticate** - Firebase token → Athlete
   ```typescript
   const decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
   const athlete = await getAthleteByFirebaseId(decodedToken.uid);
   ```

3. ✅ **Authorize** - Verify membership via `hydrateCrew(id)`
   ```typescript
   const crew = await hydrateCrew(id);
   const membership = crew.membershipsBox?.memberships?.find(
     (m: any) => m.athleteId === athlete.id
   );
   if (!membership) return 403;
   ```

4. ✅ **Validate** - Verify run exists and belongs to crew
   ```typescript
   const run = crew.runsBox?.runs?.find((r: any) => r.id === runId);
   if (!run) return 404;
   ```

5. ✅ **Execute** - Call domain function
   ```typescript
   const rsvp = await rsvpToRun({
     runId,
     athleteId: athlete.id,
     status: status as 'going' | 'maybe' | 'not-going',
   });
   ```

6. ✅ **Return** - RSVP object with athlete data

**Key Points:**
- ✅ Follows param-based procedure pattern correctly
- ✅ Uses `hydrateCrew()` for authorization (checks membership)
- ✅ Validates run belongs to crew via `runsBox`
- ✅ Proper error handling at each step
- ✅ Returns structured response

---

### 4. Frontend Usage ✅

**File:** `app/runcrew/[runCrewId]/runs/[runId]/page.tsx:225`

```typescript
const handleRSVP = async (status: 'going' | 'maybe' | 'not-going') => {
  setRsvpLoading(true);
  try {
    const response = await api.post(`/runcrew/${runCrewId}/runs/${runId}/rsvp`, { status });
    if (response.data.success) {
      setCurrentRSVP(status);
      // Refresh run data to get updated RSVPs
      const crewResponse = await api.get(`/runcrew/${runCrewId}`);
      // ... update state
    }
  } catch (err: any) {
    console.error('Error RSVPing:', err);
    alert(err.response?.data?.error || 'Failed to RSVP');
  } finally {
    setRsvpLoading(false);
  }
};
```

**Key Points:**
- ✅ Uses correct API endpoint: `/runcrew/${runCrewId}/runs/${runId}/rsvp`
- ✅ Sends `status` in request body
- ✅ Handles response and updates UI
- ✅ Refreshes run data to get updated RSVPs

---

## Data Flow

### RSVP Creation Flow

```
1. Member sees RunCrewRun (run)
   ↓
2. Member clicks RSVP button (going/maybe/not-going)
   ↓
3. Frontend: POST /api/runcrew/[runCrewId]/runs/[runId]/rsvp
   Body: { status: "going" }
   ↓
4. API Route:
   - Extract params: { id: runCrewId, runId }
   - Authenticate: Firebase token → Athlete
   - Authorize: hydrateCrew(id) → check membership
   - Validate: Verify run exists in crew.runsBox.runs
   - Execute: rsvpToRun({ runId, athleteId, status })
   ↓
5. Domain Function:
   - Upsert run_crew_run_rsvps table
   - Where: { runId, athleteId } (unique constraint)
   - Create or Update: { status }
   - Include: Athlete data
   ↓
6. Database:
   - Creates/updates row in run_crew_run_rsvps
   - Foreign key: eventId → run_crew_runs.id
   - Foreign key: athleteId → Athlete.id
   - Unique: One RSVP per athlete per run
   ↓
7. Response: { success: true, rsvp: {...} }
   ↓
8. Frontend: Updates UI, refreshes run data
```

---

## Relationship Structure

### Foreign Key Relationship

```
RunCrewRun (one run)
    ↓ (has many)
RunCrewRunRSVP[] (many RSVPs)
    ↓ (each RSVP has)
Athlete (one athlete per RSVP)
```

**Key Relationship:**
- **One Run** can have **Many RSVPs**
- **One Athlete** can have **One RSVP per Run** (enforced by `@@unique([runId, athleteId])`)
- RSVP expresses the athlete's **intent** (going/maybe/not-going) to attend a specific run

**Answer to Original Question:**
> "so the member sees the runcrewvent and basically authors by athleteid their intent so is its a foreign key to that one run?"

**For Runs (not events):** Yes, exactly! The RSVP is:
- **Authored by**: `athleteId` (the member expressing intent)
- **Foreign Key to**: `runId` (the specific run)
- **Expresses**: `status` (intent: going/maybe/not-going)
- **Unique**: One RSVP per athlete per run (composite unique constraint)

---

## Verification Checklist

- ✅ Schema has correct foreign keys
- ✅ Schema has unique constraint `[runId, athleteId]`
- ✅ Schema `id` field has `@default(cuid())`
- ✅ Domain function uses correct upsert pattern
- ✅ Domain function uses correct unique constraint name
- ✅ API route follows param-based procedure
- ✅ API route authenticates via Firebase token
- ✅ API route authorizes via membership check
- ✅ API route validates run belongs to crew
- ✅ Frontend uses correct API endpoint
- ✅ Frontend sends correct request format
- ✅ Error handling is proper at each layer

---

## Conclusion

**Run RSVP implementation is CORRECT and COMPLETE.**

The implementation properly follows the param-based procedure pattern:
1. ✅ Params extracted from route
2. ✅ Authentication via Firebase token
3. ✅ Authorization via membership check
4. ✅ Validation of run belongs to crew
5. ✅ Domain function execution
6. ✅ Proper response handling

The foreign key relationship is correct: each RSVP links one `athleteId` to one `runId`, expressing the athlete's intent to attend that specific run.


