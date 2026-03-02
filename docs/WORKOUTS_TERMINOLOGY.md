# Workout Terminology: Segments vs Steps

## The Confusion

**Garmin calls them:** "steps"
**We call them:** "segments"

**They're the same thing** - just different terminology!

---

## Our Model: Segments

**workout_segments table:**
- One row = one segment of the workout
- Examples: "Warmup", "Main Set", "Cooldown", "Interval", "Recovery"

**Segment = One part of the workout**

---

## Garmin's Model: Steps

**Garmin uses "steps"** - same concept:
- One step = one part of the workout
- Examples: Warmup step, Interval step, Cooldown step

**Step = One part of the workout** (Garmin's terminology)

---

## The Mapping

**Our segments → Garmin steps:**

```
Our Segment "Warmup" (1 mile, HR 120-140)
  ↓
Garmin Step: {
  stepOrder: 1,
  intensity: "WARMUP",
  durationType: "DISTANCE",
  durationValue: 1609,
  targetType: "HEART_RATE",
  targetValueLow: 120,
  targetValueHigh: 140
}
```

**Same thing, different names:**
- **Segment** = Our term (workout_segments table)
- **Step** = Garmin's term (steps array in Garmin API)

---

## Why The Confusion?

**Garmin API structure:**
```json
{
  "workoutName": "Track Tuesday",
  "steps": [
    { stepOrder: 1, ... },  // Warmup
    { stepOrder: 2, ... },  // Interval
    { stepOrder: 3, ... }   // Cooldown
  ]
}
```

**Our schema:**
```prisma
workout_segments [
  { stepOrder: 1, title: "Warmup", ... },
  { stepOrder: 2, title: "Interval", ... },
  { stepOrder: 3, title: "Cooldown", ... }
]
```

**They're the same thing!** We just call them "segments" in our DB, Garmin calls them "steps" in their API.

---

## Assembly Service

**garmin-training-service.ts:**
- Takes our `workout_segments` (array)
- Converts each segment → Garmin step
- Returns Garmin format with `steps` array

**Function name:** `assembleGarminWorkout()`
- Input: `workout.segments` (our segments)
- Output: `garminWorkout.steps` (Garmin steps)

---

## Summary

- **Segment** = Our term (workout_segments table)
- **Step** = Garmin's term (steps array in API)
- **Same concept** - one part of the workout
- **Assembly service** converts segments → steps

**No confusion:** Segment = Step, just different terminology!
