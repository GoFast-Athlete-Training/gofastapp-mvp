# Workout Segment Structure - How It Works

## Segment = One Part of the Workout

**Segment structure:**
- **Segment** = One part of the workout (e.g., "Warmup", "Main Set", "Cooldown", "Interval")
- **Duration** = How long this segment lasts (miles or time)
- **Targets** = What to aim for during this segment (pace, HR, speed, etc.)
- **Repeat** = Repeat this segment N times (for intervals)

---

## Example: "Track Tuesday" Workout

**Workout:** Track Tuesday (Intervals)

**Segments:**

1. **Segment: "Warmup"**
   - Duration: 1 mile
   - Targets: HR 120-140 bpm
   - Repeat: 1x

2. **Segment: "Interval"**
   - Duration: 0.5 miles (800m)
   - Targets: Pace 5:30/mile (330 sec/km), HR 160-180 bpm
   - Repeat: 6x

3. **Segment: "Recovery"**
   - Duration: 0.25 miles (400m)
   - Targets: HR 120-140 bpm
   - Repeat: 6x (repeats with interval above)

4. **Segment: "Cooldown"**
   - Duration: 1 mile
   - Targets: HR 100-120 bpm
   - Repeat: 1x

---

## How It Maps to Garmin

**Segment → Garmin Step:**

Each segment becomes a Garmin step (or steps if it repeats):

```
Segment "Warmup" (1 mile, HR 120-140)
  ↓
Garmin Step: {
  stepOrder: 1,
  intensity: "WARMUP",
  durationType: "DISTANCE",
  durationValue: 1609, // meters
  targetType: "HEART_RATE",
  targetValueLow: 120,
  targetValueHigh: 140
}

Segment "Interval" (0.5 miles, Pace 5:30/mile, HR 160-180, repeat 6x)
  ↓
Garmin Step: {
  stepOrder: 2,
  type: "REPEAT",
  repeatValue: 6
}
Garmin Step: {
  stepOrder: 3,
  intensity: "INTERVAL_TARGET",
  durationType: "DISTANCE",
  durationValue: 800, // meters
  targetType: "PACE",
  targetValueLow: 330,
  targetValueHigh: 330,
  secondaryTargetType: "HEART_RATE",
  secondaryTargetValueLow: 160,
  secondaryTargetValueHigh: 180
}
```

---

## Structure Confirmation

✅ **Segment = One part** (warmup, main set, cooldown, interval, recovery, etc.)
✅ **Targets on segment** = What to aim for during that segment
✅ **Can have multiple targets** = Pace AND HR on same segment
✅ **Repeat capability** = Segment can repeat N times (for intervals)

**This structure makes sense** - segment is the warmup/main/cooldown, and you set targets on that segment.

---

## Schema Structure

```prisma
model workout_segments {
  id               String            @id
  workoutId        String
  stepOrder        Int               // Order: 1, 2, 3...
  title            String            // "Warmup", "Main Set", "Cooldown", "Interval"
  durationType     String            // "DISTANCE" or "TIME"
  durationValue    Float             // Miles or minutes
  targets          Json?             // Array of targets for this segment
  repeatCount      Int?              // Repeat this segment N times
  notes            String?
}
```

**Example data:**
```json
{
  "stepOrder": 1,
  "title": "Warmup",
  "durationType": "DISTANCE",
  "durationValue": 1.0,
  "targets": [
    { "type": "HEART_RATE", "valueLow": 120, "valueHigh": 140 }
  ],
  "repeatCount": null
}
```

---

## Confirmed: Structure Makes Sense

- Segment = warmup/main/cooldown/etc.
- Targets = what to aim for during that segment
- Assembly service converts segment → Garmin step(s)

**Perfect!** ✅
