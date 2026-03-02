# Workouts Schema Proposal

## Review Before Migration

This document proposes the final schema structure. Review carefully before running `prisma migrate dev`.

---

## Proposed Schema

### 1. workouts table

```prisma
model workouts {
  id               String            @id @default(cuid())
  title            String
  workoutType      WorkoutType       // Easy, Tempo, Intervals, LongRun, Speed, Strength
  description      String?
  athleteId        String
  // Garmin integration - workoutId is source of truth (aligns with Garmin concept)
  garminSyncedAt   DateTime?         // When pushed to Garmin
  // Timestamps
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  
  // Relations
  Athlete          Athlete           @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  segments         workout_segments[]

  @@index([athleteId])
  @@index([workoutType])
}
```

**Fields:**
- `id` - Our workoutId (String, cuid) - **source of truth, aligns with Garmin workoutId concept**
- `title` - Workout name (e.g., "Track Tuesday")
- `workoutType` - Enum: Easy, Tempo, Intervals, LongRun, Speed, Strength
- `description` - Optional description
- `athleteId` - Owner of workout
- `segments` - Relation to workout_segments

**No Garmin-specific fields** - Garmin connection/auth lives on Athlete model (garmin_is_connected, garmin_access_token, etc.)

**No hardcoded fields:** No warmUpMiles, mainSetMiles, coolDownMiles, totalMiles, workoutFormat, effortType, effortModifier, steps JSON

---

### 2. workout_segments table

```prisma
model workout_segments {
  id               String            @id @default(cuid())
  workoutId        String
  stepOrder        Int               // Order in workout (1, 2, 3...)
  title            String            // e.g., "Warmup", "Main Set", "Cooldown", "Interval"
  
  // Duration
  durationType     String            // "DISTANCE" or "TIME"
  durationValue    Float             // Miles (if DISTANCE) or minutes (if TIME)
  
  // Targets (optional)
  paceTarget       String?           // e.g., "8:00/mile" (user-friendly format)
  hrMin            Int?              // Heart rate min (bpm)
  hrMax            Int?              // Heart rate max (bpm)
  
  // Repeat capability
  repeatCount      Int?              // Repeat this segment N times (for intervals)
  
  // Metadata
  notes            String?           // User notes for this segment
  
  // Timestamps
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  
  // Relations
  workout          workouts          @relation(fields: [workoutId], references: [id], onDelete: Cascade)

  @@index([workoutId])
  @@index([workoutId, stepOrder])
}
```

**Fields:**
- `id` - Segment ID
- `workoutId` - FK to workouts
- `stepOrder` - Order in workout (1, 2, 3...)
- `title` - Segment name (e.g., "Warmup", "Main Set", "Cooldown", "Interval")
- `durationType` - "DISTANCE" or "TIME"
- `durationValue` - Miles (if DISTANCE) or minutes (if TIME)
- `paceTarget` - User-friendly pace string (e.g., "8:00/mile")
- `hrMin`, `hrMax` - Heart rate range (bpm)
- `repeatCount` - Repeat this segment N times (for intervals)
- `notes` - User notes

**Extensible:** Can add any segment type - no hardcoded assumptions

---

### 3. Athlete relation update

```prisma
model Athlete {
  // ... existing fields ...
  workouts                workouts[]
  workout_segments        workout_segments[]
}
```

---

## workoutId Alignment

**Garmin uses:** `workoutId` (singular, Int64)

**Our schema:**
- `workouts.id` = Our workoutId (String, cuid) - **source of truth, aligns with Garmin workoutId concept**

**Alignment:**
- ✅ We use `workoutId` terminology - our `id` IS the workoutId
- ✅ When we push to Garmin, they return their workoutId (Int) - we can store it elsewhere if needed (e.g., in a mapping table or just reference by our id)
- ✅ No separate `garminWorkoutId` field - our `id` is the workoutId

**Clean:** One workoutId concept, our `id` aligns with Garmin's workoutId concept.

---

## What We're Removing (Legacy Hardcoded Fields)

❌ **Removed from workouts:**
- `workoutFormat` - Hardcoded enum, segments handle structure
- `totalMiles` - Calculated from segments
- `warmUpMiles` - Now just a segment with title "Warmup"
- `mainSetMiles` - Now just a segment with title "Main Set"
- `coolDownMiles` - Now just a segment with title "Cooldown"
- `effortType` - Hardcoded enum, not needed
- `effortModifier` - Hardcoded nonsense
- `steps` JSON - Garmin service assembles from segments

**Rationale:** These were hardcoded assumptions. Segments are extensible.

---

## Example Data Structure

**Workout: "Track Tuesday"**
```json
{
  "id": "workout_abc123",
  "title": "Track Tuesday",
  "workoutType": "Intervals",
  "description": "Speed work",
  "athleteId": "athlete_xyz",
  "segments": [
    {
      "id": "seg_1",
      "stepOrder": 1,
      "title": "Warmup",
      "durationType": "DISTANCE",
      "durationValue": 1.0,
      "paceTarget": null,
      "hrMin": 120,
      "hrMax": 140
    },
    {
      "id": "seg_2",
      "stepOrder": 2,
      "title": "Interval",
      "durationType": "DISTANCE",
      "durationValue": 0.5,
      "paceTarget": "5:30/mile",
      "hrMin": 160,
      "hrMax": 180,
      "repeatCount": 6
    },
    {
      "id": "seg_3",
      "stepOrder": 3,
      "title": "Recovery",
      "durationType": "DISTANCE",
      "durationValue": 0.25,
      "paceTarget": null,
      "hrMin": 120,
      "hrMax": 140,
      "repeatCount": 6
    },
    {
      "id": "seg_4",
      "stepOrder": 4,
      "title": "Cooldown",
      "durationType": "DISTANCE",
      "durationValue": 1.0,
      "paceTarget": null,
      "hrMin": 100,
      "hrMax": 120
    }
  ]
}
```

**Garmin service assembles this into:**
- Step 1: Warmup (1 mile, HR 120-140)
- Step 2: REPEAT (6x)
- Step 3: Interval (0.5 miles @ 5:30/mile pace, HR 160-180)
- Step 4: Recovery (0.25 miles, HR 120-140)
- (Steps 3-4 repeat 6 times)
- Step 5: Cooldown (1 mile, HR 100-120)

---

## Questions to Review

1. **durationType as String vs Enum?**
   - Current: `String` ("DISTANCE" or "TIME")
   - Alternative: `Enum DurationType { DISTANCE, TIME }`
   - **Recommendation:** Keep as String for flexibility (can add "CALORIES", "OPEN", etc. later)

2. **paceTarget format?**
   - Current: `String` ("8:00/mile")
   - Alternative: Separate fields (paceMinutes, paceSeconds, paceUnit)
   - **Recommendation:** Keep as String - user-friendly, Garmin service converts

3. **repeatCount handling?**
   - Current: `repeatCount` on segment
   - Alternative: Separate repeat model
   - **Recommendation:** Keep on segment - simpler, works for most cases

4. **Should we add UX fields now?**
   - `difficultyLevel` String?
   - `estimatedTime` Int? (minutes)
   - `tags` String[]?
   - `favorite` Boolean?
   - **Recommendation:** Add later if needed - keep schema minimal for now

5. **workoutType enum - keep or make String?**
   - Current: `WorkoutType` enum
   - Alternative: `String`
   - **Recommendation:** Keep enum - it's a known set, helps with filtering

---

## Migration Impact

**Breaking changes:**
- Removes: `workoutFormat`, `totalMiles`, `warmUpMiles`, `mainSetMiles`, `coolDownMiles`, `effortType`, `effortModifier`, `steps` JSON
- Adds: `workout_segments` table
- Changes: `workouts` table structure

**Data migration needed:**
- If existing workouts have data, need to migrate to segments
- Or: Mark old fields as deprecated, create segments from them

---

## Review Checklist

- [ ] Schema structure looks good?
- [ ] workoutId alignment correct?
- [ ] Segments model extensible enough?
- [ ] All hardcoded fields removed?
- [ ] Relations correct?
- [ ] Indexes appropriate?
- [ ] Migration plan clear?

**Ready to proceed?** Review this proposal, then we'll create the migration.
