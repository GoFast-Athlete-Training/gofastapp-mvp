# Workouts Schema Verification

## ✅ Final Schema Structure

### workouts table
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
  Athlete          Athlete           @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  segments         workout_segments[]

  @@index([athleteId])
  @@index([workoutType])
  @@index([garminWorkoutId])
}
```

**✅ Clean:** No hardcoded fields (warmUpMiles, mainSetMiles, etc.)

### workout_segments table (bolt-on capability)
```prisma
model workout_segments {
  id               String            @id @default(cuid())
  workoutId        String
  stepOrder        Int               // Order in workout (1, 2, 3...)
  title            String            // e.g., "Warmup", "Main Set", "Cooldown", "Interval"
  durationType     String            // "DISTANCE" or "TIME"
  durationValue    Float             // Miles (if DISTANCE) or minutes (if TIME)
  paceTarget       String?           // e.g., "8:00/mile" (user-friendly format)
  hrMin            Int?              // Heart rate min (bpm)
  hrMax            Int?              // Heart rate max (bpm)
  repeatCount      Int?              // Repeat this segment N times (for intervals)
  notes            String?           // User notes for this segment
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  workout          workouts          @relation(fields: [workoutId], references: [id], onDelete: Cascade)

  @@index([workoutId])
  @@index([workoutId, stepOrder])
}
```

**✅ Extensible:** Segments handle all workout structure - no hardcoded assumptions

### Athlete relation
```prisma
model Athlete {
  // ...
  workouts                workouts[]
  workout_segments        workout_segments[]
}
```

---

## ✅ workoutId Alignment

- **Our internal ID:** `workouts.id` (String, cuid) - source of truth
- **Garmin's ID:** `workouts.garminWorkoutId` (Int) - stored after push
- **Alignment:** We use `workoutId` terminology in API client to match Garmin

**No confusion:** One workoutId concept, two IDs (ours + Garmin's).

---

## ✅ What We Killed (Hardcoded Legacy)

❌ **Removed from schema:**
- `warmUpMiles` - now just a segment with title "Warmup"
- `mainSetMiles` - now just a segment with title "Main Set"  
- `coolDownMiles` - now just a segment with title "Cooldown"
- `totalMiles` - calculated from segments
- `workoutFormat` field - segments handle structure
- `effortType` field - not needed
- `effortModifier` field - not needed
- `steps` JSON field - Garmin service assembles from segments

**✅ Clean approach:** Segments are extensible, Garmin service assembles everything.

---

## ✅ Schema Verification Checklist

- [x] `workouts` table has no hardcoded fields
- [x] `workout_segments` table exists as separate model
- [x] Segments have `stepOrder` for ordering
- [x] Segments support `repeatCount` for intervals
- [x] Segments have `durationType` (DISTANCE/TIME)
- [x] Segments have `paceTarget` and `hrMin/hrMax` for targets
- [x] `garminWorkoutId` stores Garmin's workoutId (Int)
- [x] `workouts.id` is our internal ID (String)
- [x] Relation: `workouts.segments` → `workout_segments.workout`
- [x] Indexes: `[workoutId]` and `[workoutId, stepOrder]` on segments
- [x] No duplicate models

---

## ✅ Ready for Migration

Schema is clean, extensible, and ready for `prisma migrate dev`.
