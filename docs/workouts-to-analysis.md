# Workouts → analysis pipeline

Mental model for logged-run Splits (prescribed vs actual per lap).

## Pipeline

```text
do workout          → workoutId (instance)
name match          → snap planned_workout onto workoutId
spawn + parse       → workout_segments + workout_segment_laps (actuals)
pace analyzer       → mutate lap.paceDeltaSecPerMile (one job)
adaptive analyzer   → after deltas exist (future)
```

## One analyzer, two functions

Module: `lib/training/workout-pace-analyzer.ts`

| Function | Role |
|----------|------|
| `translatePlannedOntoWorkout` | Pure in-memory: map compact plan rows onto detected laps |
| `writeLapPaceDeltas` | Only DB write: `workout_segment_laps.paceDeltaSecPerMile` |

**Does not:** write actuals, POST Garmin, add planned rows, invent headlines.

## Compact plan vs instance

| Store | Shape | Example |
|-------|-------|---------|
| `planned_workout_segments` | Compact | 4×400 as one row (`repeatCount: 4`) |
| `assembleGarminWorkout` | Garmin wire | `WorkoutRepeatStep` (do not change) |
| `workout_segments` + laps | Instance | Actual blocks + Garmin cuts |

Do not explode `planned_workout_segments`. The analyzer expands repeats onto **laps** on the spawned `workoutId`.

## Look at my metrics

`POST /api/training/pace-for-pace` → `resolvePaceForPace` → parse laps (if needed) → `analyzeWorkoutPaceDeltas`.

Not called from GET. GET formats Splits from lap deltas already written.

## What we killed

- `workouts.paceDeltaSecPerMile` as truth for Splits
- Match-time whole-run delta write
- GET `computeWorkoutPerformanceAnalysis` inventing `executionHeadline`
- `canCompareWholeRun` (443 vs 446) as success
- Post-run coach on this path (parked)

## Splits UX (MVP1)

**Show:** total time, avg HR, average pace, **Your splits** (pace + delta per lap), reflection + photo.

**Fail — no detailData (exact copy):**

> We failed to get your activity detail and can't show your pace deltas. Please contact app support.

**Fail open:** translator could not aim (shape mismatch, OPEN bookends) → say why; do not substitute a summary headline.

## Just finished vs Performance tab

Two lanes — do not mix copy or deeplinks.

| Lane | When | Surfaces | Job |
|------|------|----------|-----|
| **Just finished** | Seconds after Garmin match | Push (`workout.complete`), workout emerald card, plan day, home “Review run” | Congrats + *this run* (totals, splits CTA, tap to `/workouts/{id}`) |
| **Performance** | Anytime / end of week | `/performance` tab, mobile Performance tab | Weekly rollup + last runs + optional 5K confirm — **not** the push notification job |

**Canonical tap target:** planned run → `/workouts/{workoutId}`; unmatched activity → `/activities/{activityId}`.

5K pace: suggest on workout after interval/race match; athlete confirms via `POST /api/training/workout/[id]/confirm-five-k-pace` — never auto-write on match.

## Pace delta convention

`paceDeltaSecPerMile = prescribedMid − actual` (positive = faster than prescribed band midpoint).

OPEN bookends (warmup/cooldown/recovery) → lap delta `null`.
