# Training: Activity, Planned Activity, and Workout Model

This document defines the canonical terms and IDs for **activity**, **planned activity**, and **workout** in GoFast. Get this right here first; then RunTogether (and other satellites) can align.

---

## 1. The Three Concepts

| Concept | Meaning | When it exists |
|--------|--------|-----------------|
| **Activity** | A **recorded** occurrence: a run, ride, etc. that actually happened. | After the athlete (or a device) records it — e.g. Garmin sync, manual log. |
| **Planned activity** | What the athlete **should do** on a given day (or in a given slot). | When a plan or program assigns work to a date/session. |
| **Workout** | A **reusable template** for a type of workout (e.g. “6×800 intervals”, “20 min tempo”). | When defined in the athlete’s library or in a program’s session. |

- **Activity** = did (recorded).
- **Planned activity** = do (scheduled).
- **Workout** = definition/template (can be used in plans or sessions).

---

## 2. Where They Live in GoFast MVP

### 2.1 Activity (recorded)

- **Model:** `athlete_activities`
- **Table:** `athlete_activities`
- **Primary key:** `id`
- **Stable external id:** `sourceActivityId` (e.g. Garmin activity id), unique per athlete/source.

**Use in APIs / code:**

- **Activity id:** `athlete_activities.id` — use this when you need a single canonical id (e.g. `activityId` in links or APIs).
- **Source id:** `sourceActivityId` when talking to providers (Garmin, Strava, etc.).

**Fields (summary):** `activityType`, `activityName`, `startTime`, `duration`, `distance`, `source`, `summaryData`, `detailData`, etc. This is the “whole activity thing”: one row = one recorded activity.

---

### 2.2 Planned activity / training day

- **Models:** `training_days_executed`; for **plan structure** on the athlete app, `training_plans.planWeeks` (JSON) holds per-week **schedule strings** (same compact format as club `runSchedule`), which are parsed to create dated `workouts` rows.
- **Purpose:** “What was planned for this day?” and “Did it get done?”.

**Training Plan Day Structure:**

A **training plan day** should have:
- **Title** (e.g. "Track Tuesday", "Long Run Sunday")
- **Description** (optional notes, context)
- **Optional `workoutId` reference** — links to a `workouts` template as a **"snap"** (snapshot/reference)
  - When `workoutId` is set, you can **derive** things from the workout (e.g. `totalMiles`, `workoutType`, `workoutFormat`)
  - But the day can **override** or customize (e.g. "do this workout but 6 miles instead of 5")
- **Custom fields** (pace goals, HR zones, distance overrides, etc.) — user flexibility: "I know my body"

**training_days_executed**

- One row per planned day (for an athlete) **when it gets executed**.
- **Ids:** `id` (row id), `athleteId`, optional `activityId`, optional `workoutId` (should be added to schema).
- **activityId:** Optional link to the **recorded** activity that fulfilled this planned day. References `athlete_activities.id` (conceptually; FK not enforced in schema today). When set, “planned” is linked to “did”.
- **plannedData:** JSON for what was planned. Should include:
  - `title` (string)
  - `description` (string, optional)
  - `workoutId` (string, optional) — reference to `workouts.id` as a "snap"
  - `paceGoals` (object, optional) — target paces
  - `hrGoals` (object, optional) — target heart rate zones
  - `distanceOverride` (number, optional) — override workout's totalMiles
  - `notes` (string, optional)
- **date,** **weekIndex,** **dayIndex:** When this planned day sits in the plan.

**training_plans.planWeeks (JSON) — schedule strings**

- Array of week objects, one per plan week, e.g. `{ "weekNumber": 1, "phase": "Base", "schedule": "M:5E W:6T Th:5E Sa:5E Su:14L" }`.
- The `schedule` string is parsed (see `lib/training/schedule-parser.ts`) to create `workouts` with `planId` and `workout_segments` for that calendar week.

So:

- **Planned activity** = a slot in a plan (date + title + description + optional workout reference + custom goals), optionally linked to an **activity** via `activityId` when executed.
- **Workout as "snap"** = the day can reference a workout template to derive structure, but the day has its own title/description and can override values.

---

### 2.3 Workout (template)

- **Model:** `workouts`
- **Table:** `workouts`
- **Primary key:** `id`
- **Scope:** Per athlete (`athleteId`).

**Use in APIs / code:**

- **Workout id:** `workouts.id` — e.g. `workoutId` in routes or payloads when you mean “this workout template”.

**Fields (summary):** `title`, `workoutType`, `workoutFormat`, `description`, `totalMiles`, `warmUpMiles`, `mainSetMiles`, `coolDownMiles`, `effortType`, `effortModifier`. This is the athlete’s (or system’s) **library** of workout definitions.

**Relationship to planned activity:** 

- A planned day **references** a workout by `workoutId` (optional) — the workout is a **"snap"** (snapshot/reference)
- The day can **derive** values from the workout (e.g. `totalMiles`, `workoutType`, `workoutFormat`)
- But the day has its own **title, description** and can **override** values (e.g. "do 6 miles instead of 5")
- The day can also have **custom goals** (pace, HR) that aren't in the workout template
- This gives users flexibility: "I know my body" — they can customize the workout for that specific day

**Example:**
- Workout template: "6×800 intervals" (totalMiles: 5.0, workoutType: Intervals)
- Plan day: title="Track Tuesday", workoutId="workout_123", distanceOverride=6.0, paceGoals={target: "5:30/mile"}
  - Derives structure from workout (intervals, 800m repeats)
  - But overrides distance to 6.0 miles and adds pace goals

---

### 2.4 Training plan structure

- **Models:** `training_plans`, `workouts` (plan-scoped), `workout_segments`
- **Purpose:** Plan metadata, AI outline (phases + weekly schedule strings), and materialized calendar workouts.

**training_plans**

- **`phases`** (JSON?) — AI phase ranges, e.g. `[{ name, startWeek, endWeek }]`
- **`planWeeks`** (JSON?) — AI weekly **schedule strings** per week (see 2.2)
- **`preferredDays`** — Snapshot of preferred training days (1=Mon … 7=Sun) used when generating schedules

**The plan hierarchy (gofastapp-mvp):**

```
training_plans
  ├─ phases (JSON) — phase ranges
  ├─ planWeeks (JSON) — weekNumber + phase label + schedule string
  └─ planned_workouts → workouts (+ workout_segments), created from schedule strings per week
```

Relational tables `training_plan_phases` and `training_plan_weeks` were **removed** from this product schema; they duplicated the above and were unused by the app.

**When a day gets executed:**

- A `training_days_executed` row is created (or updated)
- `plannedData` copies/snapshots the day's plan (or links to a `workouts` row)
- User can **set workout** (select from library or create new)
- User can **set pace, miles, HR goals** (override workout defaults if needed)
- When done, `activityId` links to the recorded `athlete_activities` row

---

## 3. ID Naming Conventions

- **Activity (recorded):**  
  - DB: `athlete_activities.id`  
  - APIs/params: `activityId` when you mean this id.

- **Planned day row:**  
  - DB: `training_days_executed.id`  
  - APIs/params: e.g. `plannedDayId` or `trainingDayId` if you need to refer to the row.

- **Workout (template):**  
  - DB: `workouts.id`  
  - APIs/params: `workoutId` when you mean this id.

So:

- **activityId** → recorded activity (`athlete_activities.id`).
- **workoutId** → workout template (`workouts.id`).
- Planned activity is “a day/slot + plannedData”; if you need a single id for that slot, use the id of the row that represents it (e.g. `training_days_executed.id` or the session_workout id in RunTogether).

---

## 4. RunTogether Alignment (session_workout)

RunTogether has **program sessions** and, inside a session, **session_workouts**. In our terms:

- A **session_workout** is a **planned workout** for that session: “do this workout in this session.”
- It is **not** an **activity** (nothing is recorded yet).
- It is **like** a **workout** in that it has type, title, description, payload — but it’s an **instance** tied to a session, not the athlete’s reusable `workouts` table.

So:

- **RunTogether `session_workout.id`** = id of that planned workout instance (good to call it `workoutId` in UI/API when you mean “this session workout”).
- **RunTogether does not** (today) link to GoFast MVP `workouts.id` or `athlete_activities.id`; the intent is to keep the model consistent so that later we can:
  - Optionally reference an MVP **workout** template when creating a session_workout, and/or
  - Optionally link a completed session_workout to an **activity** when the athlete records it.

---

## 5. Summary Table

| Term | Model / location | Primary ID | Typical param name |
|------|-------------------|------------|--------------------|
| **Activity** (recorded) | `athlete_activities` | `id` | `activityId` |
| **Planned activity** (day/slot) | `training_days_executed` (+ optional `planningDays`) | `training_days_executed.id` | e.g. `plannedDayId` / `trainingDayId` |
| **Workout** (template) | `workouts` | `id` | `workoutId` |
| **Session workout** (RunTogether) | `session_workout` | `id` | `workoutId` (for that instance) |

---

## 6. Other “activity” and “workout” usages in MVP

- **Runs (city_runs, etc.):** `workoutDescription` and “workout types” in copy are **descriptive text**, not the `workouts` model. No `workoutId` there unless we add it.
- **postRunActivity / stravaUrl:** “Activity” in product copy or Strava URL is the same idea as **activity** (something that happened); Strava’s id is external, we store our own in `athlete_activities` and optionally reference it from `training_days_executed.activityId`.

---

## 7. Schema Notes: What Needs to Be Added

**Current state vs. desired state:**

- ✅ `workouts` table exists — plan-linked workouts and standalone library
- ✅ `training_plans.planWeeks` (JSON) — weekly schedule strings (canonical plan outline)
- ✅ `training_days_executed.plannedData` (JSON) — executed day data
- ⚠️ `training_days_executed.workoutId` — **NOT YET IN SCHEMA** — should be added as optional FK to `workouts.id`
- ⚠️ `training_days_executed.activityId` — exists but no FK constraint (should reference `athlete_activities.id`)

**Recommended schema additions:**

```prisma
model training_days_executed {
  id          String   @id
  athleteId   String
  workoutId   String?  // ADD THIS: optional reference to workouts.id (the "snap")
  activityId  String?  @unique
  weekIndex   Int
  dayIndex    Int
  date        DateTime
  plannedData Json?    // Should include: title, description, workoutId (if not in FK), paceGoals, hrGoals, distanceOverride, notes
  analysis    Json?
  feedback    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime
  Athlete     Athlete  @relation(fields: [athleteId], references: [id])
  Workout     workouts? @relation(fields: [workoutId], references: [id]) // ADD THIS relation
  // Note: activityId FK to athlete_activities should also be added when ready
}
```

**planWeeks entry shape (schedule string per week):**

```typescript
type PlanWeekEntry = {
  weekNumber: number;
  phase?: string;            // e.g. "Base", "Build"
  schedule: string;          // e.g. "M:5E W:6T Th:5E Sa:5E Su:14L" — parsed into workouts
};
```

**plannedData JSON (for `training_days_executed`) — still recommended when logging executed days:**

```typescript
type PlannedDaySnapshot = {
  title?: string;
  description?: string;
  workoutId?: string;
  paceGoals?: { target?: string; min?: string; max?: string };
  hrGoals?: { zone?: string; min?: number; max?: number };
  distanceOverride?: number;
  notes?: string;
};
```

---

## 8. The Workflow: Plan Day → Workout → Garmin → Activity

**The complete flow:**

1. **Set a workout** (user flexibility: "I know my body")
   - User selects a workout from their library (`workouts` table) OR creates a new one
   - Or user starts from scratch without a workout reference
   - The plan day gets a `workoutId` reference (optional) — the workout is a "snap"

2. **Set pace, miles, HR goals** (customize for this specific day)
   - User sets target pace (e.g. "5:30/mile")
   - User sets target miles (can override workout's `totalMiles`)
   - User sets HR zones (e.g. "Zone 4-5")
   - These go into `plannedData` (or are reflected on the materialized `workouts` row for that day)

3. **Push to Garmin** (future: send workout to Garmin Connect)
   - The planned day's structure (from workout snap + customizations) gets formatted for Garmin
   - Garmin creates a workout on the device/watch
   - User executes the workout on their Garmin device
   - **See section 9 below for Garmin workout structure mapping**

4. **Get the activity back** (sync from Garmin)
   - Garmin syncs the completed activity → `athlete_activities` table
   - We have the activity data (distance, pace, HR, etc.)

5. **Associate activity to workout** (link "did" to "planned")
   - `training_days_executed.activityId` = `athlete_activities.id`
   - Now we can compare: planned vs actual (pace goals vs actual pace, distance goal vs actual distance)
   - The workout "snap" is preserved in `plannedData.workoutId` so we know what template was used

**Key insight:** The workout is a **reference/snap**, not embedded. The day has its own identity (title, description) and can customize. When executed, the activity links back to the day, and the day remembers which workout template it referenced.

---

## 9. Garmin Workout Structure Mapping

**Note:** Exact Garmin Connect Training API JSON structure requires Developer Program access. This section outlines the mapping from our model to Garmin's expected format based on available documentation.

### Garmin Training API Overview

- **API:** Garmin Connect Training API (requires Developer Program approval)
- **Purpose:** Publish workouts and training plans to Garmin Connect calendar
- **Formats:** Supports GPX, TCX, and FIT file formats
- **Workout Structure:** Workouts are composed of discrete **steps** with:
  - `durationType` - how long the step lasts (time, distance, open-ended)
  - `durationValue` - the duration length
  - `targetType` - target for the step (pace, heart rate, power, etc.)
  - `targetValueLow` and `targetValueHigh` - target ranges

### Garmin API Schema (from API docs) - SIMPLIFIED EXPLANATION

**ANSWERS TO YOUR QUESTIONS:**

1. **Does Garmin show Miles, Pace, HR as goals?**
   - YES, but they're structured as **STEPS** (segments)
   - Each step has: HOW LONG (miles/time) + WHAT TO AIM FOR (pace/HR)

2. **Is it done as "steps"?**
   - YES! Everything is **steps**. Even a simple "run 3 miles" = 1 step.

3. **What is "intensity"?**
   - Just a **LABEL** (WARMUP, ACTIVE, COOLDOWN, etc.)
   - It doesn't control the target - it's just for display/organization
   - The actual goal is set by `targetType` (PACE, HEART_RATE, etc.)

4. **Can targetType be anything?**
   - YES! It's an enum with ~18 options: PACE, HEART_RATE, SPEED, CADENCE, POWER, OPEN (no target), etc.
   - You can even have **BOTH** pace AND HR using `targetType` + `secondaryTargetType`

**How Garmin Structures Workouts:**

Garmin uses **STEPS** - each step is a segment of your workout. Think of it like this:

```
Workout = {
  workoutName: "Track Tuesday",
  sport: "RUNNING",
  steps: [
    Step 1: Warmup (1 mile, easy pace)
    Step 2: Repeat block (do steps 3-4, 6 times)
      Step 3: Interval (800m @ fast pace)
      Step 4: Recovery (400m easy)
    Step 5: Cooldown (1 mile, easy pace)
  ]
}
```

**Each Step Has:**

1. **HOW LONG** (duration):
   - `durationType`: "DISTANCE" or "TIME" 
   - `durationValue`: the number (e.g. 1609 meters, or 600 seconds)
   - **Miles = DISTANCE type with meters value** (1 mile = 1609 meters)

2. **HOW HARD** (intensity):
   - `intensity`: "WARMUP", "ACTIVE", "COOLDOWN", "INTERVAL_TARGET", "INTERVAL_REST", "RECOVERY", "REST"
   - This is just a label - doesn't control the target

3. **WHAT TO AIM FOR** (target):
   - `targetType`: "PACE", "HEART_RATE", "SPEED", "OPEN" (no target), etc.
   - `targetValueLow` and `targetValueHigh`: the range
   - **Pace = targetType: "PACE" with seconds/km values**
   - **HR = targetType: "HEART_RATE" with bpm values**

**Workout Object:**
```typescript
{
  workoutId?: number;              // Returned by Garmin after creation
  workoutName: string;              // "Track Tuesday"
  description?: string;             // "Speed work"
  sport: string;                    // "RUNNING", "CYCLING", "SWIMMING", etc.
  estimatedDistanceInMeters?: number; // Total distance (optional, for display)
  steps: WorkoutStep[];             // Array of steps (this is the workout!)
}
```

**WorkoutStep Object:**
```typescript
{
  stepOrder: number;                // 1, 2, 3... (order in workout)
  
  // HOW LONG THIS STEP LASTS
  durationType: "DISTANCE" | "TIME" | "CALORIES" | "OPEN";  // How to measure duration
  durationValue: number;            // The value (meters, seconds, etc.)
  
  // WHAT KIND OF STEP (just a label)
  intensity: "WARMUP" | "ACTIVE" | "COOLDOWN" | "INTERVAL_TARGET" | "INTERVAL_REST" | "RECOVERY" | "REST";
  
  // WHAT TO AIM FOR (the actual goal!)
  targetType: "OPEN" | "PACE" | "HEART_RATE" | "SPEED" | "CADENCE" | "POWER" | ...;  // What you're targeting
  targetValueLow?: number;          // Lower bound (e.g. 160 bpm, or 300 sec/km pace)
  targetValueHigh?: number;         // Upper bound (e.g. 180 bpm, or 330 sec/km pace)
  
  description?: string;             // "800m @ 5K pace"
}
```

**KEY INSIGHT:**
- **Miles** = `durationType: "DISTANCE"` + `durationValue` in **meters**
- **Pace** = `targetType: "PACE"` + `targetValueLow`/`targetValueHigh` in **seconds per kilometer**
- **HR** = `targetType: "HEART_RATE"` + `targetValueLow`/`targetValueHigh` in **beats per minute**

**You can have BOTH pace AND HR targets** using `secondaryTargetType`!

**WorkoutRepeatStep Object (for intervals):**
```typescript
{
  stepOrder: number;
  type: string;                     // Should be "REPEAT" or similar
  repeatType: string;               // Enum: 11 options (likely DISTANCE, TIME, etc.)
  repeatValue: number;               // How many times to repeat
  skipLastRestStep?: boolean;       // Skip rest after last interval
}
```

**WorkoutSchedule Object:**
```typescript
{
  scheduleId?: number;              // Returned after creation
  workoutId: number;                // The workout to schedule
  date: string;                     // Date in YYYY-MM-DD format
}
```

### Mapping Our Model to Garmin Format

**From our `workouts` table + `plannedData`:**

```typescript
// Our workout model
{
  workoutType: "Intervals" | "Tempo" | "LongRun" | "Easy" | "Speed" | "Strength",
  workoutFormat: "Continuous" | "WarmupMainCooldown" | "Progression" | "IntervalsUnstructured",
  totalMiles: 5.0,
  warmUpMiles: 1.0,
  mainSetMiles: 3.0,
  coolDownMiles: 1.0,
  effortType: "FiveKEffort" | "TenKEffort" | "HalfMarathonEffort" | "MarathonEffort" | "Easy" | "RPE",
  effortModifier: 0.95
}

// Our plannedData (day customization)
{
  title: "Track Tuesday",
  description: "Speed work",
  workoutId: "workout_123",
  paceGoals: { target: "5:30/mile", min: "5:20", max: "5:40" },
  hrGoals: { zone: "Zone 4-5", min: 160, max: 180 },
  distanceOverride: 6.0
}
```

**To Garmin Workout format - SIMPLE EXAMPLE:**

```typescript
// Example: "Run 3 miles at 8:00/mile pace, keep HR under 150"

{
  workoutName: "Easy 3 Miles",
  sport: "RUNNING",
  steps: [
    {
      stepOrder: 1,
      durationType: "DISTANCE",        // HOW LONG: by distance
      durationValue: 4828,             // 3 miles = 4828 meters
      intensity: "ACTIVE",             // Just a label
      targetType: "PACE",              // WHAT TO AIM FOR: pace
      targetValueLow: 480,             // 8:00/mile = 480 sec/km
      targetValueHigh: 500,            // 8:20/mile = 500 sec/km
      secondaryTargetType: "HEART_RATE", // ALSO target HR!
      secondaryTargetValueHigh: 150    // Keep HR under 150
    }
  ]
}
```

**More Complex Example: Intervals (6×800m @ 5K pace)**

```typescript
{
  workoutName: "Track Tuesday",
  sport: "RUNNING",
  steps: [
    // Step 1: Warmup - 1 mile, easy HR
    {
      stepOrder: 1,
      durationType: "DISTANCE",
      durationValue: 1609,             // 1 mile = 1609 meters
      intensity: "WARMUP",             // Label: this is warmup
      targetType: "HEART_RATE",        // Goal: keep HR low
      targetValueLow: 120,
      targetValueHigh: 140
    },
    // Step 2: Repeat block - do steps 3-4, 6 times
    {
      stepOrder: 2,
      type: "REPEAT",
      repeatType: "DISTANCE",          // Repeat by distance (or TIME)
      repeatValue: 6                   // Repeat 6 times
    },
    // Step 3: The interval - 800m @ fast pace
    {
      stepOrder: 3,
      durationType: "DISTANCE",
      durationValue: 800,               // 800 meters
      intensity: "INTERVAL_TARGET",    // Label: this is the hard part
      targetType: "PACE",               // Goal: hit this pace
      targetValueLow: 300,             // 5:00/mile pace (fast!)
      targetValueHigh: 330              // 5:30/mile pace
    },
    // Step 4: Recovery - 400m easy
    {
      stepOrder: 4,
      durationType: "DISTANCE",
      durationValue: 400,               // 400 meters
      intensity: "INTERVAL_REST",      // Label: recovery between intervals
      targetType: "HEART_RATE",        // Goal: let HR come down
      targetValueLow: 120,
      targetValueHigh: 140
    },
    // (Steps 3-4 repeat 6 times automatically)
    // Step 5: Cooldown - 1 mile easy
    {
      stepOrder: 5,
      durationType: "DISTANCE",
      durationValue: 1609,             // 1 mile
      intensity: "COOLDOWN",
      targetType: "HEART_RATE",
      targetValueLow: 100,
      targetValueHigh: 120
    }
  ]
}
```

**Key Points:**
- **Each step = one segment** of your workout
- **durationType + durationValue** = HOW LONG (miles/time)
- **targetType + targetValueLow/High** = WHAT TO AIM FOR (pace/HR)
- **intensity** = just a label (WARMUP, ACTIVE, etc.) - doesn't control the target!
- **You can target BOTH pace AND HR** using `targetType` and `secondaryTargetType`

// Example: Tempo workout (20 min tempo)
{
  workoutName: "Tempo Thursday",
  description: "Comfortably hard effort",
  sport: "RUNNING",
  estimatedDurationInSecs: 2400,  // ~40 min total
  steps: [
    {
      stepOrder: 1,
      type: "STEP",
      intensity: "WARMUP",
      description: "10 min warmup",
      durationType: "TIME",
      durationValue: 600,         // 10 min in seconds
      durationValueType: "TIME",
      targetType: "HEART_RATE",
      targetValueLow: 120,
      targetValueHigh: 140
    },
    {
      stepOrder: 2,
      type: "STEP",
      intensity: "ACTIVE",         // or "INTERVAL_TARGET"
      description: "20 min tempo",
      durationType: "TIME",
      durationValue: 1200,        // 20 min
      targetType: "PACE",         // or "HEART_RATE" from hrGoals
      targetValueLow: 330,        // Convert from paceGoals
      targetValueHigh: 360,
      targetValueType: "PACE"
    },
    {
      stepOrder: 3,
      type: "STEP",
      intensity: "COOLDOWN",
      description: "10 min cooldown",
      durationType: "TIME",
      durationValue: 600,
      targetType: "HEART_RATE",
      targetValueLow: 100,
      targetValueHigh: 120
    }
  ]
}
```

### Conversion Logic Needed

**From `workoutType` + `workoutFormat` → Garmin step structure:**

- **Intervals** → 
  - Step 1: WARMUP intensity, DISTANCE duration
  - Step 2: REPEAT step (repeatType: DISTANCE/TIME, repeatValue: N)
  - Step 3: INTERVAL_TARGET intensity, DISTANCE/TIME duration, PACE/HEART_RATE target
  - Step 4: INTERVAL_REST intensity, DISTANCE/TIME duration
  - (Steps 3-4 repeat N times)
  - Step 5: COOLDOWN intensity, DISTANCE duration

- **Tempo** → 
  - Step 1: WARMUP intensity, TIME duration
  - Step 2: ACTIVE intensity, TIME duration, PACE/HEART_RATE target
  - Step 3: COOLDOWN intensity, TIME duration

- **LongRun** → 
  - Single step: ACTIVE intensity, DISTANCE duration, OPEN or HEART_RATE target
  - OR: WARMUP + ACTIVE + COOLDOWN if `workoutFormat = "WarmupMainCooldown"`

- **Easy** → 
  - Single step: ACTIVE intensity, DISTANCE/TIME duration, HEART_RATE target (Zone 2-3)

- **Speed** → Similar to Intervals but shorter distances/faster paces

- **Strength** → May need `sport: "STRENGTH"` and different step structure

**From `effortType` → pace/HR targets:**

- **FiveKEffort** → convert to pace range (e.g. 5K pace ± 5%)
- **TenKEffort** → convert to pace range
- **HalfMarathonEffort** → convert to pace range
- **MarathonEffort** → convert to pace range
- **Easy** → HR zone 2-3
- **RPE** → may need user input or default mapping

**Priority order for targets:**

1. **Use `plannedData.paceGoals`** if provided (user customization)
   - Convert pace string (e.g. "5:30/mile") to seconds/km for Garmin
   - Set `targetType: "PACE"`, `targetValueLow` and `targetValueHigh`
   - `targetValueType: "PACE"`

2. **Use `plannedData.hrGoals`** if provided (user customization)
   - Set `targetType: "HEART_RATE"`, `targetValueLow` and `targetValueHigh`
   - `targetValueType: "HEART_RATE"`

3. **Derive from `effortType`** + athlete baseline (`Athlete.fiveKPace`; not stored on `training_plans`)
   - FiveKEffort → 5K pace ± 5%
   - TenKEffort → 10K pace ± 5%
   - HalfMarathonEffort → HM pace ± 5%
   - MarathonEffort → Marathon pace ± 5%
   - Easy → HR Zone 2-3 (120-140 bpm typical)

4. **Use workout defaults** if nothing else available
   - Default to `targetType: "OPEN"` (no target) if no pace/HR info

### Distance and Duration Handling

**Distance:**
- **Use `plannedData.distanceOverride`** if provided (user knows their body)
- **Otherwise use `workouts.totalMiles`** (from workout snap)
- **Convert miles to meters** for Garmin: `meters = miles * 1609.34`
- Set `durationType: "DISTANCE"`, `durationValue: meters`, `durationValueType: "DISTANCE"`

**Time:**
- If workout specifies time (e.g. "20 min tempo"), convert to seconds
- Set `durationType: "TIME"`, `durationValue: seconds`, `durationValueType: "TIME"`

**Pace conversion:**
- Garmin expects pace in **seconds per kilometer** (or meters per second)
- Convert from "X:XX/mile" format:
  - `pacePerMileSeconds = minutes * 60 + seconds`
  - `pacePerKmSeconds = pacePerMileSeconds * 1.60934`
  - Use `pacePerKmSeconds` for `targetValueLow` and `targetValueHigh`

**Example:** "5:30/mile" → 330 seconds/mile → 531 seconds/km (8:51/km)

### Garmin API Endpoints (Workout Portal)

Based on Garmin's API documentation, the endpoints are:

**Workout Management:**
- `POST /workout` - Create a new workout
- `GET /workout/{workoutId}` - Get workout details
- `PUT /workout/{workoutId}` - Update an existing workout
- `DELETE /workout/{workoutId}` - Delete a workout

**Schedule Management:**
- `POST /schedule` - Create a new workout schedule
- `GET /schedule` - Get list of schedules
- `GET /schedule/{workoutScheduleId}` - Get schedule details
- `PUT /schedule/{workoutScheduleId}` - Update a schedule
- `DELETE /schedule/{workoutScheduleId}` - Delete a schedule

**Note:** There's also a "Workout Portal V2" section in the API docs - may have additional endpoints.

### Implementation Notes

- **Base URL:** `https://apis.garmin.com` (or similar - confirm from API docs)
- **Authentication:** Use `garmin_access_token` from `Athlete` model (OAuth 2.0)
- **Workout ID tracking:** Store Garmin's returned `workoutId` in `plannedData.garminWorkoutId` for later reference
- **Schedule ID tracking:** If using schedules, store `workoutScheduleId` in `plannedData.garminScheduleId`
- **Sync status:** Track whether workout was pushed to Garmin in `plannedData.garminSyncedAt`

**Implementation flow:**

1. **Convert our workout to Garmin format** using `convertWorkoutToGarminFormat(workout, plannedData)`
2. **POST to Garmin:** `POST /workout` with the formatted workout JSON
3. **Store Garmin workout ID:** Save returned `workoutId` to `plannedData.garminWorkoutId`
4. **Optional - Schedule workout:** If scheduling for a specific date, use `POST /schedule` with the `workoutId` and date
5. **Track sync:** Set `plannedData.garminSyncedAt = new Date()`

**Our API endpoints to create:**

- `POST /api/training-days/[id]/push-to-garmin` - Convert and push a training day's workout to Garmin
- `GET /api/training-days/[id]/garmin-status` - Check if workout was synced to Garmin
- `DELETE /api/training-days/[id]/garmin-workout` - Remove workout from Garmin (if needed)

### Conversion Function Structure

**Function signature:**
```typescript
function convertWorkoutToGarminFormat(
  workout: Workout,              // From workouts table
  plannedData: PlannedData,      // From training_days_executed.plannedData
  athlete: Athlete               // For pace calculations
): GarminWorkout {
  // 1. Determine sport type (RUNNING, CYCLING, etc.)
  const sport = mapWorkoutTypeToSport(workout.workoutType);
  
  // 2. Get workout name and description
  const workoutName = plannedData.title || workout.title;
  const description = plannedData.description || workout.description;
  
  // 3. Calculate total distance/duration
  const totalDistance = plannedData.distanceOverride || workout.totalMiles;
  const totalDistanceMeters = totalDistance * 1609.34;
  
  // 4. Build steps array based on workoutFormat
  const steps = buildSteps(workout, plannedData, athlete);
  
  // 5. Return Garmin workout object
  return {
    workoutName,
    description,
    sport,
    estimatedDistanceInMeters: totalDistanceMeters,
    steps
  };
}
```

**Helper functions needed:**
- `mapWorkoutTypeToSport(workoutType: WorkoutType): string` - Map to RUNNING, CYCLING, etc.
- `mapIntensity(workoutType: WorkoutType, stepType: string): string` - Map to WARMUP, ACTIVE, COOLDOWN, etc.
- `convertPaceToSecondsPerKm(paceString: string): number` - Convert "5:30/mile" to seconds/km
- `buildSteps(workout, plannedData, athlete): WorkoutStep[]` - Build step array based on workoutFormat
- `getTargetFromPlannedData(plannedData, athlete): TargetConfig` - Get pace/HR targets with priority

**Next steps:**
1. ✅ Get Garmin Connect Developer Program access (done - you have API docs access)
2. ✅ Get exact request/response JSON schemas (done - you shared the schema)
3. Implement conversion function: `convertWorkoutToGarminFormat(workout, plannedData, athlete)`
4. Implement Garmin API client: `lib/garmin-workouts.ts` with:
   - `createWorkout(workout: GarminWorkout): Promise<{ workoutId: number }>`
   - `scheduleWorkout(workoutId: number, date: string): Promise<{ scheduleId: number }>`
   - `getWorkout(workoutId: number): Promise<GarminWorkout>`
   - `updateWorkout(workoutId: number, workout: GarminWorkout): Promise<void>`
   - `deleteWorkout(workoutId: number): Promise<void>`
5. Add our API endpoints for pushing workouts:
   - `POST /api/training-days/[id]/push-to-garmin`
   - `GET /api/training-days/[id]/garmin-status`
   - `DELETE /api/training-days/[id]/garmin-workout`

---

This doc is the single place to get **activity vs planned activity vs workout** and their IDs right in GoFast MVP; RunTogether and other apps should align with this model.
