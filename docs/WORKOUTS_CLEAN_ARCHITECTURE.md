# Workouts Clean Architecture

## ✅ Clean Structure (No Hardcoded Nonsense)

### Schema

**workouts table:**
```prisma
model workouts {
  id               String            @id @default(cuid())
  title            String
  workoutType      WorkoutType       // Easy, Tempo, Intervals, LongRun, Speed, Strength
  description      String?
  athleteId        String
  garminWorkoutId  Int?              @unique // Garmin's workoutId after push
  garminSyncedAt   DateTime?         // When pushed to Garmin
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  Athlete          Athlete           @relation(...)
  segments         workout_segments[]
}
```

**workout_segments table (bolt-on capability):**
```prisma
model workout_segments {
  id               String            @id @default(cuid())
  workoutId        String
  stepOrder        Int               // Order in workout (1, 2, 3...)
  title            String            // e.g., "Warmup", "Main Set", "Cooldown", "Interval"
  durationType     String            // "DISTANCE" or "TIME"
  durationValue    Float             // Miles (if DISTANCE) or minutes (if TIME)
  paceTarget       String?           // e.g., "8:00/mile" (user-friendly)
  hrMin            Int?              // Heart rate min (bpm)
  hrMax            Int?              // Heart rate max (bpm)
  repeatCount      Int?              // Repeat this segment N times (for intervals)
  notes            String?           // User notes
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  workout          workouts          @relation(...)
}
```

### What We Killed (Hardcoded Legacy Crap)

❌ **Removed:**
- `warmUpMiles` - hardcoded, now just a segment with title "Warmup"
- `mainSetMiles` - hardcoded, now just a segment with title "Main Set"
- `coolDownMiles` - hardcoded, now just a segment with title "Cooldown"
- `totalMiles` - calculated from segments
- `workoutFormat` enum - hardcoded enum, segments handle it
- `effortType` enum - hardcoded enum, not needed
- `effortModifier` - hardcoded nonsense
- `steps` JSON field - Garmin service assembles from segments

✅ **Clean approach:**
- Segments are extensible - add any segment type you want
- Garmin service assembles everything - single source of truth
- No hardcoded assumptions about workout structure

---

## Garmin Training Service

**Single responsibility:** Assemble workouts + segments → Garmin format

```typescript
// lib/garmin-workouts/garmin-training-service.ts
export function assembleGarminWorkout(workout: Workout): GarminWorkout {
  // Takes workout + segments
  // Builds Garmin step structure
  // Returns Garmin-compatible format
}
```

**This is the ONLY place that knows about Garmin structure.**

Everything else uses our clean workout/segment model.

---

## workoutId Alignment

**Garmin uses:** `workoutId` (singular, Int64)

**Our schema:**
- `workouts.id` = Our internal ID (String, cuid) - **source of truth in our app**
- `workouts.garminWorkoutId` = Garmin's workoutId (Int) - stored after push

**Alignment:**
- ✅ We use `workoutId` terminology in API client (matches Garmin)
- ✅ Our internal `id` is the source of truth
- ✅ When we push, we get Garmin's `workoutId` and store it in `garminWorkoutId`

**No confusion:** One workoutId concept, two IDs (ours + Garmin's).

---

## Flow

```
User creates workout with segments
  ↓
workouts table (id, title, workoutType, ...)
  ↓
workout_segments table (workoutId, stepOrder, title, miles, pace, HR, repeatCount, ...)
  ↓
assembleGarminWorkout(workout + segments)
  ↓
Garmin step structure
  ↓
POST /workout → Garmin
  ↓
Garmin returns: { workoutId: 2201 }
  ↓
Store: workouts.garminWorkoutId = 2201
```

---

## Extensibility

**Want to add a new segment type?** Just add a segment with a new title.

**Want to add UX fields?** Add to `workout_segments` table:
- `difficulty` String?
- `equipment` String?
- `location` String?
- etc.

**Want to change Garmin format?** Only touch `garmin-training-service.ts`.

**Clean, extensible, no hardcoded assumptions.**
