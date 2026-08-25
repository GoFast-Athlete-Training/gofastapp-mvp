# Planned vs spawned workout — stone tablet

**What you are solving:** planned day vs just-a-workout. Never-done must not have a `workoutId`.

**The move:** activity match **spawns** `workoutId`. Same create habit as today, aimed at the right object.

MVP1 leave the live `workouts` table. This is the target.

## Two rows, not one

```text
planned_workout              PRESCRIBE  (the plan day)
  id
  planId                     required
  date, week, catalogue
  garminWorkoutId            push-to-watch lives HERE
  -- no actuals, no activity, no delta
  planned_workout_segments   children (targets only). Required. Not workout_segments.

workouts                     INSTANCE  (they did it, or started it)
  id                         still the service key AFTER spawn
  plannedWorkoutId           FK, null if leftover individual
  copied title / segments / paces at spawn
  -- measure hangs off this copy

athlete_activities           FACT
  id                         raw
```

Never done Saturday: `planned_workout` only. Hub / calendar read that. No `workouts` row. No null-actual haystack.

## Spawn law (the “bad” create, used right)

```text
find activityId
  → match planned_workout.id
       (title, garminWorkoutId, plan day, catalogue)
  → INSERT workouts
       copy name, segments, paces from that planned row
       workouts.plannedWorkoutId = planned.id
  → bolt laps onto the COPY’s segments
```

Leftover Garmin (no planned match): spawn `workouts` with `plannedWorkoutId` null. Athlete thing. Not a plan day.

Do not materialize a `workouts` row for every future Saturday at plan create. Materializer writes **`planned_workout`**. That is the split.

## True FKs

```text
planned_workout.id
workouts.plannedWorkoutId     → planned_workout.id     (null = individual)
workout_segments.workoutId    → workouts.id            (the copy)
laps.activityId + segmentId
```

Match does not write `workouts.matchedActivityId` as the meaning of “planned.” The existence of `workouts` + `plannedWorkoutId` is “they did this plan day.”

## Why this unfogs

| Question | Where |
|----------|--------|
| What is prescribed this Saturday? | `planned_workout` |
| Did they do it? | exists `workouts` where `plannedWorkoutId` = that id |
| How did they do it? | laps on that spawned workout |
| Just a run, no plan? | `workouts.plannedWorkoutId` is null |

Planned hydration never bleeds into a finished instance. Rematerialize / 5K adapt updates **future `planned_workout` rows**. Spawned copies stay what they ran.

## Watch-before-run

Garmin riffs off the **planned tree**. Serialize `planned_workout` + `planned_workout_segments`. Store `garminWorkoutId` on the planned parent. Inbound activity matches that id, then spawns `workouts`. Do not spawn an instance just to push, and do not push instance segments (they do not exist yet).

Optional later: athlete taps “I’m doing this” and you spawn early. Not required. Match-spawn is the law.

## Measure

Same as [PACE_DELTA_STONE.md](./PACE_DELTA_STONE.md): laps on the spawned workout’s segments. `target − actual`. No delta column on `planned_workout`. No JSON copies of the activity onto either row.
