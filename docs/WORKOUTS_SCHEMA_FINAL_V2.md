# Workouts Schema - Final V2 (Generic Targets Array)

## Final Schema Structure

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

### workout_segments table (Generic Targets Array)

```prisma
model workout_segments {
  id               String            @id @default(cuid())
  workoutId        String
  stepOrder        Int
  title            String            // "Warmup", "Main Set", "Cooldown", "Interval"
  durationType     String            // "DISTANCE" or "TIME"
  durationValue    Float             // Miles or minutes
  targets          Json?             // Array of target objects (see below)
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

## Targets Array Structure

**targets JSON format:**
```json
[
  {
    "type": "PACE",
    "valueLow": 480,
    "valueHigh": 500
  },
  {
    "type": "HEART_RATE",
    "valueLow": 160,
    "valueHigh": 180
  }
]
```

**Supports:**
- Multiple targets (pace AND HR, or pace AND cadence, etc.)
- Any Garmin target type (PACE, HEART_RATE, SPEED, CADENCE, POWER, GRADE, RESISTANCE, OPEN, etc.)
- Extensible - add new target types without schema changes

---

## How Assembly Service Uses It

```typescript
// Garmin service iterates through targets array
for (const target of segment.targets || []) {
  if (targets.length === 0) {
    step.targetType = GarminTargetType.OPEN;
  } else if (targets.length === 1) {
    step.targetType = target.type;
    step.targetValueLow = target.valueLow;
    step.targetValueHigh = target.valueHigh;
  } else {
    // First target is primary
    step.targetType = targets[0].type;
    step.targetValueLow = targets[0].valueLow;
    step.targetValueHigh = targets[0].valueHigh;
    // Second target is secondary
    step.secondaryTargetType = targets[1].type;
    step.secondaryTargetValueLow = targets[1].valueLow;
    step.secondaryTargetValueHigh = targets[1].valueHigh;
  }
}
```

---

## Benefits

✅ **Not hardcoded** - Supports all Garmin target types
✅ **Extensible** - Add new target types without schema changes
✅ **Multiple targets** - Can have pace AND HR, pace AND cadence, etc.
✅ **Assembly service handles it** - Just iterate through targets array
✅ **Matches Garmin structure** - Service converts array → Garmin format

---

## Example

**User creates segment:**
- Title: "Main Set"
- Miles: 3
- Pace: "8:00/mile" → Converted to 480-500 seconds/km
- HR: 160-180 bpm

**Stored in DB:**
```json
{
  "targets": [
    { "type": "PACE", "valueLow": 480, "valueHigh": 500 },
    { "type": "HEART_RATE", "valueLow": 160, "valueHigh": 180 }
  ]
}
```

**Assembly service:**
- Iterates targets array
- First target → primary (PACE)
- Second target → secondary (HEART_RATE)
- Passes to Garmin

---

## Ready for Review

This is the final schema - generic targets array, assembly service handles conversion.
