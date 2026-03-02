# Workouts Final Shape & workoutId Alignment

## ✅ workoutId Alignment with Garmin

**Garmin uses:** `workoutId` (singular, Int64)

**Our schema:**
- `workouts.id` (String, cuid) - **Our internal ID** (source of truth in our DB)
- `workouts.garminWorkoutId` (Int, unique) - **Garmin's workoutId** (stored after push)

**Alignment:**
- ✅ We use `workoutId` terminology in API client (matches Garmin)
- ✅ We store Garmin's `workoutId` in `garminWorkoutId` field
- ✅ Our internal `id` is the source of truth for our app
- ✅ When we push to Garmin, we get back their `workoutId` and store it

**Example flow:**
1. User creates workout → `workouts.id = "workout_abc123"` (our ID)
2. Push to Garmin → Garmin returns `{ workoutId: 2201 }` (Garmin's ID)
3. We store → `workouts.garminWorkoutId = 2201`
4. Now we can reference it either way:
   - Our app: `/workouts/workout_abc123`
   - Garmin API: `GET /workout/2201`

---

## Final Schema Shape

```prisma
model workouts {
  // Our internal ID (source of truth)
  id               String         @id @default(cuid())
  
  // Basic workout info
  title            String
  description      String?
  workoutType      WorkoutType    // Easy, Tempo, Intervals, LongRun, Speed, Strength
  workoutFormat    WorkoutFormat? // Continuous, WarmupMainCooldown, Progression, IntervalsUnstructured
  
  // Legacy fields (for backwards compatibility / UX)
  totalMiles       Float?
  warmUpMiles      Float?
  mainSetMiles     Float?
  coolDownMiles    Float?
  effortType       EffortType?    // FiveKEffort, TenKEffort, etc.
  effortModifier   Float?
  
  // Garmin integration
  garminWorkoutId  Int?           @unique // Garmin's workoutId after push
  garminSyncedAt   DateTime?      // When pushed to Garmin
  
  // Garmin-compatible structure (source of truth for Garmin)
  steps            Json?          // Array of GarminWorkoutStep objects
  
  // Relationships
  athleteId        String
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  Athlete          Athlete        @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@index([athleteId])
  @@index([workoutType])
  @@index([garminWorkoutId])
}
```

---

## UX-Only Fields (Can Add Anytime)

**You can add fields that help users understand what's going on** - these don't affect Garmin conversion, they're just for UX:

```prisma
model workouts {
  // ... existing fields ...
  
  // UX-only fields (optional, for user understanding)
  difficultyLevel  String?        // "Beginner", "Intermediate", "Advanced" (just for display)
  estimatedTime    Int?           // Estimated minutes (calculated from steps, but nice to show)
  tags             String[]        // ["speed", "endurance", "track"] (for filtering/search)
  notes            String?         // User's personal notes about this workout
  lastCompletedAt  DateTime?       // When user last did this workout
  favorite         Boolean         @default(false) // Mark as favorite
  // ... etc.
}
```

**These UX fields:**
- ✅ Don't affect Garmin conversion (conversion only uses `steps` JSON)
- ✅ Can be added anytime without breaking Garmin integration
- ✅ Help users organize, filter, and understand their workouts
- ✅ Stored in our DB, never sent to Garmin

---

## Garmin Steps Structure (stored in `steps` JSON)

The `steps` field stores an array of Garmin-compatible step objects:

```typescript
steps: [
  {
    stepOrder: 1,
    type: "STEP",
    intensity: "WARMUP",
    durationType: "DISTANCE",
    durationValue: 1609, // meters
    targetType: "HEART_RATE",
    targetValueLow: 120,
    targetValueHigh: 140
  },
  {
    stepOrder: 2,
    type: "REPEAT",
    repeatType: "DISTANCE",
    repeatValue: 6
  },
  {
    stepOrder: 3,
    type: "STEP",
    intensity: "INTERVAL_TARGET",
    durationType: "DISTANCE",
    durationValue: 800, // meters
    targetType: "PACE",
    targetValueLow: 300, // seconds/km
    targetValueHigh: 330
  },
  // ... more steps
]
```

**This is the source of truth for Garmin** - when we push, we send this structure.

---

## Conversion Flow

```
User Input (UX-friendly)
  ↓
Our Schema (workouts table)
  ├─ title, description (user-friendly)
  ├─ totalMiles, warmUpMiles, etc. (legacy/UX)
  └─ steps (Garmin-compatible JSON) ← Source of truth for Garmin
  ↓
convertWorkoutToGarminFormat()
  ↓
Garmin API Format
  ├─ workoutName: title
  ├─ description: description
  └─ steps: steps (from JSON)
  ↓
POST /workout
  ↓
Garmin returns: { workoutId: 2201 }
  ↓
Store: garminWorkoutId = 2201
```

---

## Summary

✅ **workoutId alignment:** We use `workoutId` terminology to match Garmin, but our internal `id` is the source of truth

✅ **Final shape:** `steps` JSON is the source of truth for Garmin; other fields are UX/legacy

✅ **UX fields:** Can add any UX-only fields anytime - they don't affect Garmin conversion

✅ **Source of truth:** 
- **Our app:** `workouts.id` (String)
- **Garmin:** `workouts.garminWorkoutId` (Int) + `workouts.steps` (JSON)
