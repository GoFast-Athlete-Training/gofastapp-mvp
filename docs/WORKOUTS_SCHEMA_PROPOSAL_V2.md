# Workouts Schema Proposal V2 - Generic Target Structure

## Decision: Match Garmin's Generic Structure

**Garmin supports ~18 target types:**
- PACE, HEART_RATE, SPEED, CADENCE, POWER, GRADE, RESISTANCE, OPEN, etc.

**We should match Garmin's structure** - not hardcode to only pace/HR.

---

## Proposed Schema

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

### workout_segments table (Generic Target Structure)

```prisma
model workout_segments {
  id               String            @id @default(cuid())
  workoutId        String
  stepOrder        Int
  title            String            // "Warmup", "Main Set", "Cooldown", "Interval"
  durationType     String            // "DISTANCE" or "TIME"
  durationValue    Float             // Miles or minutes
  
  // Primary target (matches Garmin structure)
  targetType       String?           // "PACE", "HEART_RATE", "SPEED", "CADENCE", "POWER", "OPEN", etc.
  targetValueLow   Float?           // Lower bound (seconds/km for PACE, bpm for HR, etc.)
  targetValueHigh  Float?           // Upper bound
  
  // Secondary target (can have BOTH pace AND HR!)
  secondaryTargetType    String?
  secondaryTargetValueLow  Float?
  secondaryTargetValueHigh Float?
  
  // Repeat capability
  repeatCount      Int?              // Repeat this segment N times
  
  // Metadata
  notes            String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  workout          workouts          @relation(fields: [workoutId], references: [id], onDelete: Cascade)

  @@index([workoutId])
  @@index([workoutId, stepOrder])
}
```

---

## How It Works

**User Input (UX-friendly):**
- Pace: "8:00/mile" → Convert to seconds/km → `targetType: "PACE"`, `targetValueLow: 480`, `targetValueHigh: 500`
- HR: 160-180 bpm → `targetType: "HEART_RATE"`, `targetValueLow: 160`, `targetValueHigh: 180`

**Storage (matches Garmin):**
- `targetType: "PACE"`, `targetValueLow: 480`, `targetValueHigh: 500`
- `targetType: "HEART_RATE"`, `targetValueLow: 160`, `targetValueHigh: 180`

**Garmin Service:**
- Just passes through - no conversion needed!
- `targetType` → Garmin's `targetType`
- `targetValueLow/High` → Garmin's `targetValueLow/High`

---

## Benefits

✅ **Not hardcoded** - Supports all 18 Garmin target types
✅ **Matches Garmin exactly** - No conversion needed in service
✅ **Extensible** - Add new target types without schema changes
✅ **Supports secondary targets** - Can have pace AND HR
✅ **UX layer handles conversion** - Form converts "8:00/mile" → seconds/km

---

## Example

**User creates segment:**
- Title: "Main Set"
- Miles: 3
- Pace: "8:00/mile"
- HR: 160-180

**Stored in DB:**
```json
{
  "targetType": "PACE",
  "targetValueLow": 480,
  "targetValueHigh": 500,
  "secondaryTargetType": "HEART_RATE",
  "secondaryTargetValueLow": 160,
  "secondaryTargetValueHigh": 180
}
```

**Garmin service:**
- Just passes through - already in Garmin format!

---

## Decision

**Use generic structure (targetType + values)** - matches Garmin, not hardcoded, supports all target types.
