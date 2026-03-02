# Workouts Schema: Current vs Proposed

## Side-by-Side Comparison

### Current Schema (Before)

```prisma
model workouts {
  id               String         @id
  title            String
  workoutType      WorkoutType
  description      String?
  workoutFormat    WorkoutFormat?  // ❌ Hardcoded enum
  totalMiles       Float?         // ❌ Hardcoded field
  warmUpMiles      Float?         // ❌ Hardcoded field
  mainSetMiles     Float?         // ❌ Hardcoded field
  coolDownMiles    Float?         // ❌ Hardcoded field
  effortType       EffortType?    // ❌ Hardcoded enum
  effortModifier   Float?          // ❌ Hardcoded field
  athleteId        String
  steps            Json?          // ❌ Garmin structure stored here
  createdAt        DateTime       @default(now())
  updatedAt        DateTime
  Athlete          Athlete        @relation(...)
}
```

**Problems:**
- Hardcoded fields (warmUpMiles, mainSetMiles, coolDownMiles)
- Hardcoded enums (workoutFormat, effortType)
- Garmin structure stored in JSON (not extensible)
- No segments model

---

### Proposed Schema (After)

```prisma
model workouts {
  id               String            @id @default(cuid())
  title            String
  workoutType      WorkoutType       // ✅ Keep enum (known set)
  description      String?
  athleteId        String
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  Athlete          Athlete           @relation(...)
  segments         workout_segments[] // ✅ Extensible segments
}

model workout_segments {
  id               String            @id @default(cuid())
  workoutId        String
  stepOrder        Int               // Order (1, 2, 3...)
  title            String            // "Warmup", "Main Set", etc.
  durationType     String            // "DISTANCE" or "TIME"
  durationValue    Float             // Miles or minutes
  paceTarget       String?           // "8:00/mile"
  hrMin            Int?
  hrMax            Int?
  repeatCount      Int?              // Repeat N times
  notes            String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  workout          workouts          @relation(...)
  
  @@index([workoutId])
  @@index([workoutId, stepOrder])
}
```

**Improvements:**
- ✅ No hardcoded fields
- ✅ Segments are extensible
- ✅ Garmin service assembles from segments
- ✅ Clean, maintainable structure

---

## Field-by-Field Comparison

| Field | Current | Proposed | Reason |
|-------|---------|----------|--------|
| `id` | `String @id` | `String @id @default(cuid())` | Auto-generate IDs |
| `title` | ✅ Keep | ✅ Keep | Same |
| `workoutType` | ✅ Keep enum | ✅ Keep enum | Known set, helps filtering |
| `description` | ✅ Keep | ✅ Keep | Same |
| `workoutFormat` | ❌ Remove | ❌ Removed | Hardcoded, segments handle it |
| `totalMiles` | ❌ Remove | ❌ Removed | Calculate from segments |
| `warmUpMiles` | ❌ Remove | ❌ Removed | Now a segment with title "Warmup" |
| `mainSetMiles` | ❌ Remove | ❌ Removed | Now a segment with title "Main Set" |
| `coolDownMiles` | ❌ Remove | ❌ Removed | Now a segment with title "Cooldown" |
| `effortType` | ❌ Remove | ❌ Removed | Hardcoded enum, not needed |
| `effortModifier` | ❌ Remove | ❌ Removed | Hardcoded nonsense |
| `steps` JSON | ❌ Remove | ❌ Removed | Garmin service assembles from segments |
| `garminWorkoutId` | ❌ Don't add | ❌ Not needed | Our `id` IS the workoutId |
| `garminSyncedAt` | ❌ Don't add | ❌ Not needed | Garmin connection/auth lives on Athlete |
| `segments` relation | ❌ Add | ✅ Add | Extensible segments model |

---

## What Gets Created

**New table:** `workout_segments`
- Stores individual segments of a workout
- Extensible - can add any segment type
- Supports repeats for intervals
- Has pace and HR targets

**Updated table:** `workouts`
- Removes hardcoded fields
- Adds segments relation
- **No Garmin-specific fields** - Garmin connection/auth lives on Athlete model
- **No separate garminWorkoutId** - our `id` IS the workoutId

---

## Migration Strategy

**Option 1: Clean slate (if no production data)**
- Drop old fields
- Create workout_segments table
- Start fresh

**Option 2: Migrate existing data (if has data)**
- Keep old fields temporarily (deprecated)
- Create workout_segments table
- Migrate old workouts to segments:
  - If `warmUpMiles` exists → create segment "Warmup"
  - If `mainSetMiles` exists → create segment "Main Set"
  - If `coolDownMiles` exists → create segment "Cooldown"
- Remove old fields in next migration

**Recommendation:** Check if `workouts` table has data first.

---

## Review Questions

1. **Is the segments model extensible enough?** ✅ Yes - can add any segment type
2. **Are we removing too much?** ✅ No - removing hardcoded assumptions
3. **Will this break existing code?** ⚠️ Yes - need to update code that uses old fields
4. **Is workoutId alignment clear?** ✅ Yes - our `id` IS the workoutId (aligns with Garmin concept)
5. **Can we add UX fields later?** ✅ Yes - segments are extensible

---

## Next Steps After Approval

1. Review this proposal
2. Confirm migration strategy (clean slate vs migrate data)
3. Create migration file
4. Update code to use segments
5. Test workout creation and Garmin push
