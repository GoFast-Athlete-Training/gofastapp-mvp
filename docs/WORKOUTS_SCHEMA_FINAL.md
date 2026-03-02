# Workouts Schema - Final Proposal

## Clean Schema (No garminWorkoutId Field)

### workouts table

```prisma
model workouts {
  id               String            @id @default(cuid())
  title            String
  workoutType      WorkoutType
  description      String?
  athleteId        String
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  Athlete          Athlete           @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  segments         workout_segments[]

  @@index([athleteId])
  @@index([workoutType])
}
```

**Key points:**
- `id` = workoutId (source of truth, aligns with Garmin workoutId concept)
- No Garmin-specific fields - Garmin connection/auth lives on Athlete model
- Clean, simple structure

### workout_segments table

```prisma
model workout_segments {
  id               String            @id @default(cuid())
  workoutId        String
  stepOrder        Int
  title            String            // "Warmup", "Main Set", "Cooldown", "Interval"
  durationType     String            // "DISTANCE" or "TIME"
  durationValue    Float             // Miles or minutes
  paceTarget       String?           // "8:00/mile"
  hrMin            Int?
  hrMax            Int?
  repeatCount      Int?              // Repeat N times
  notes            String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  workout          workouts          @relation(fields: [workoutId], references: [id], onDelete: Cascade)

  @@index([workoutId])
  @@index([workoutId, stepOrder])
}
```

---

## workoutId Concept

**Our `workouts.id` IS the workoutId** - aligns with Garmin's workoutId concept.

When we push to Garmin:
- Garmin returns their workoutId (Int)
- We don't need to store it separately
- Our `id` is the workoutId we use everywhere

**Clean:** One workoutId concept, our `id` is it.

---

## What We Removed

❌ `garminWorkoutId` - Not needed, our `id` IS the workoutId
❌ `garminSyncedAt` - Not needed, Garmin connection/auth lives on Athlete
❌ `workoutFormat` - Hardcoded enum
❌ `totalMiles`, `warmUpMiles`, `mainSetMiles`, `coolDownMiles` - Hardcoded fields
❌ `effortType`, `effortModifier` - Hardcoded enums/fields
❌ `steps` JSON - Garmin service assembles from segments

---

---

## Target Fields Analysis

**hrMin/hrMax:**
- ✅ **NOT hardcoded** - These ARE Garmin's format (bpm)
- ✅ Matches Garmin's `targetType: HEART_RATE` with `targetValueLow`/`targetValueHigh`
- ✅ This is correct

**paceTarget:**
- ✅ **User-friendly format** - "8:00/mile" is easier than 480 seconds/km
- ✅ Garmin service converts to seconds/km for Garmin API
- ✅ This is fine - UX convenience, converted to Garmin format

**Are we hardcoding to only pace/HR?**
- Currently: Only pace and HR (covers 95% of running workouts)
- Garmin supports: PACE, HEART_RATE, SPEED, CADENCE, POWER, GRADE, RESISTANCE, OPEN, etc.
- **Can add other target types later if needed** - segments are extensible

---

## Ready for Review

This is the clean, final schema proposal. Review and approve before migration.
