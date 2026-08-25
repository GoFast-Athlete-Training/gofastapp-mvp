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

workouts                     INSTANCE  (they did it — Garmin match spawns)
  id                         = planned_workouts.id  (same-id; acq/prod club pattern)
  planId                     set at spawn
  plannedWorkoutId           = id (redundant FK; null on leftover individual)
  copied title / segments / paces at spawn
  -- measure hangs off this copy

athlete_activities           FACT
  id                         raw
```

Never done Saturday: `planned_workout` only. Calendar reads `planned_workouts.id`. No `workouts` row until match.

## Spawn law (the “bad” create, used right)

```text
find activityId
  → match planned_workout.id
  → INSERT workouts  id = planned.id
       copy name, segments, paces from that planned row
  → bolt laps onto the COPY’s segments
```

Leftover Garmin (no planned match): spawn `workouts` with new id, `planId` / `plannedWorkoutId` null. Pre-split rows stay as-is — **no backfill**.

Do not materialize a `workouts` row for every future Saturday at plan create. Materializer writes **`planned_workout`**. That is the split.

## Trace (same id, not a second uuid)

```text
planned_workouts.id   clxyz     prescribe / calendar / week strip
workouts.id           clxyz     instance after spawn (same string, different table)
workouts.planId       set       training plan parent
```

Prisma / Postgres: PKs are per-table. Two models, same string — valid. Mutate prescribe and instance in separate statements.

| Question | Where |
|----------|--------|
| What is prescribed this Saturday? | `planned_workouts.id` |
| Did they do it? | `workouts` row exists with `id` = that planned id |
| How did they do it? | laps on that spawned workout |
| Just a run, no plan? | `workouts` with its own id; `planId` null |

Legacy FK spawn (pre same-id): `workouts.plannedWorkoutId → planned.id` with a different `workouts.id`. Week cards still resolve; do not rewrite.

## True FKs

```text
planned_workout.id
workouts.id                  same as planned.id after spawn (forward)
workouts.plannedWorkoutId    → planned_workout.id (null = individual)
workout_segments.workoutId   → workouts.id
laps.activityId + segmentId
```

Match does not write `workouts.matchedActivityId` as the meaning of “planned.” A `workouts` row at `planned.id` means they did this plan day.

## Why this unfogs

Planned hydration never bleeds into a finished instance. Rematerialize / 5K adapt updates **future `planned_workout` rows**. Spawned copies stay what they ran.

## Watch-before-run

Garmin riffs off the **planned tree**. Serialize `planned_workout` + `planned_workout_segments`. Store `garminWorkoutId` on the planned parent. Inbound activity matches that id, then spawns `workouts`. Do not spawn an instance just to push, and do not push instance segments (they do not exist yet).

Optional later: athlete taps “I’m doing this” and you spawn early. Not required. Match-spawn is the law.

## Measure

Same as [PACE_DELTA_STONE.md](./PACE_DELTA_STONE.md): laps on the spawned workout’s segments. `target − actual`. No delta column on `planned_workout`. No JSON copies of the activity onto either row.

## Workout-day hydration (web)

Week strip and calendar always show the **plan** (`plannedWorkoutId`). Only the workout-day card (“here’s your workout / this was the run”) runs through `hydratePlanButSwapIfExecuted` in [`lib/training/hydrate-plan-day.ts`](../lib/training/hydrate-plan-day.ts):

```text
FIND spawned instance on the card
if workoutId     → kind executed (review, skip, unlink)
else planned     → kind planned (open, Garmin, schedule, match-to-spawn)
```

No collapsed `planned ?? workout` open id. No spawn on open / push / schedule / hydrate.

**Mobile (later):** home week strip already labels days via `getPlanDayStatus` without needing `workoutId`. Race-page day tap still gates on `workoutId` — follow web workout-day hydration and open via `plannedWorkoutId` when not spawned.

## Stub — city_run (later; do not build)

`city_runs` is overbuilt the same way old `workouts` was: prescribe + RSVP + recap + feed + optional `workoutId` on one row.

Later split for the feed system:

```text
planned_city_run      the event as advertised
executed_city_run     same id when it happened (showed up, recap, feed)
```

When the event has a **prescribed workout**, that is a **different triangle** — not “city_run is the workout”:

```text
planned_city_run
  → club-scoped / group-training planned workout   (parent = group session, not training_plans)
executed_city_run                                  feed / RSVPs
executed workout                                   Garmin spawn, same-id with that planned workout
```

Three objects. Do not hang actuals and feed off `city_runs.workoutId` long term. Long rabbit hole — stub only.
