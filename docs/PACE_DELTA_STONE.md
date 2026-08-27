# Pace delta — stone tablet (step 2)

**Adaptive handoff:** `pace_adjustment_log.qualityWorkoutsCount` / `qualityAvgDeltaSecPerMile` were dropped — never a read path. Do not build adaptive on the log table. SOT is `workouts.paceDeltaSecPerMile`. Week-level Tempo/Intervals avg is computed live as `structuredPaceAvgDeltaSecPerMile` in `week-performance-metrics.ts`. The log table is a notification inbox (`summaryMessage`), not an analyzer.

**Freeze here.** Former us already shipped the three-table bolt. Do not invent a fourth place to store “how they ran.”

```text
athlete_activities          raw. activityId. Garmin detail/laps live here.
        │
        │ matchedActivityId
        ▼
workouts                    plan row + rollup (paceDeltaSecPerMile)
        │
        │ workoutId
        ▼
workout_segments            prescribed step (targets JSON) + rolled actuals
        │
        │ segmentId + activityId
        ▼
workout_segment_laps        one Garmin lap bolted onto one segment
```

`workout_segment_laps` **is** the bolt: `activityId` + `segmentId` + `lapIndex` + `avgPaceSecPerMile`.

`workout_segments.actualPaceSecPerMile` is the rollup of those laps.

`workouts.paceDeltaSecPerMile` is the rollup of work-segment `target − actual`. It still exists. It still gets **mutated**. A null rollup is not “we have no laps.”

Pipeline law:

```text
1. MATCH     activityId (raw) → workout.matchedActivityId
             then bolt detail laps → workout_segment_laps.segmentId
2. ANALYZE   write segment actuals + workouts.paceDelta  ← THIS FILE
3. ADAPT     only after those writes
4. DISPLAY   render segment_laps / segment actuals / rollup. No second brain.
```

This file is step 2 only.

---

## The three tables (already built)

### `workout_segments` — prescription + actuals on the same row

Prescribed (never overwrite): `title`, `durationType`, `durationValue`, `targets` JSON, `paceTargetEncodingVersion`, `repeatCount`.

Bolted actuals: `actualPaceSecPerMile`, `actualDistanceMiles`, `actualDurationSeconds`.

Schema: “Lap-matched actuals (prescribed targets JSON is never overwritten).”

### `workout_segment_laps` — the bolt

One row per Garmin lap mapped onto a prescribed segment:

- `activityId` → raw `athlete_activities`
- `segmentId` → `workout_segments`
- `lapIndex` — 0-based in Garmin `Laps[]`
- `avgPaceSecPerMile`, `avgHeartRate`, `distanceMiles`, `durationSeconds`

Uniques: `(activityId, lapIndex)` and `(segmentId, lapIndex)`.

This is what “activityId has to bolt onto workoutId / segmentId” already is. Concurrent webhooks are fine; this table is the join.

### `workouts.paceDeltaSecPerMile` — rollup only

`Int?`. Schema comment (do not “improve” this):

```text
targetPaceSecPerMile − actual  →  positive = faster than prescribed
```

| Sign | Meaning |
|------|---------|
| `> 0` | faster than target |
| `0` | on target |
| `< 0` | slower than target |
| `null` | rollup not written **or wiped** — check laps before assuming “never analyzed” |

Same formula on each work segment: `target − actualPaceSecPerMile`.

Credits treat rollup `paceDelta >= 0` as “on or faster.”

+/- after a finished workout is **the laps and segment actuals**. The workout column is the headline number. If laps exist and the headline is null, display the laps. Do not hide the bolt because the rollup was wiped.

---

## What “analyze” actually is

There is **no** `PaceAnalyzerService`.

Step 2 is:

1. persist `workout_segment_laps` (bolt)
2. write `workout_segments.actual*` from those laps
3. write `workouts.paceDeltaSecPerMile` as the mean of work-segment `target − actual`

The wipe in `clearWorkoutSegmentExecution` deletes **all three**: laps, segment actuals, and the rollup. That is why it felt like deltas “went away.”

Two live writers. They fight.

### Writer A — match-time whole-run

[`lib/training/apply-activity-to-workout.ts`](../lib/training/apply-activity-to-workout.ts)

On `applyActivityToWorkout`:

```text
paceDelta = targetPaceSecPerMile − actualAvgPaceSecPerMile
```

only when **all** of:

- workout has **no** paced work segments (`!hasPacedWorkSegments`)
- `targetPaceSecPerMile` exists (first non-warmup/cooldown PACE target)
- `actualAvgPaceSecPerMile` exists (from `activity.averageSpeed`)

If the workout **has** paced work segments (Intervals / Tempo / progression with targets), Writer A **leaves the column null** on purpose (`e47e4ef`, Jul 29 2026 — “score work segments not whole-run avg”).

That was correct: do not judge a structured workout by full-run average.

That was incomplete: Writer A then immediately runs adaptive/credits against the column it just refused to write.

### Writer B — bolt-time work-segment mean

[`lib/training/activity-to-segment-execution.ts`](../lib/training/activity-to-segment-execution.ts)

On successful lap → segment assignment (`mutateSegmentExecution`):

```text
for each work-titled segment with a PACE target and bolted laps:
  deltas.push(target − segmentActualPace)
paceDelta = round(mean(deltas))
evaluationEligibleFlag = true
```

This is the real step-2 write for Tempo/Intervals workouts. Added `b878f0e` (May 29 2026) as “activity-to-segment execution parsing.”

**Before it writes, it always clears.**

`clearWorkoutSegmentExecution` sets:

- `paceDeltaSecPerMile = null`
- `evaluationEligibleFlag = false`
- deletes `workout_segment_laps` for that activity
- nulls each segment’s actuals

Then either:

- alignment succeeds → Writer B may write a new delta
- alignment fails / no laps / no segments → **column stays null**

That is the mutation former-us already knew about. Summary-time delta (Writer A) **dies** the moment detail parse runs, even if parse fails.

`recordAlignmentFailure` → same clear → null.

Unmatch (`clearActivityFromWorkout`) → null. That one is correct.

---

## Trace — every mutation of the column

| Order | Function | File | What happens to `paceDelta` |
|------|----------|------|-----------------------------|
| 1 | `applyActivityToWorkout` | `apply-activity-to-workout.ts` | Write whole-run delta **or leave null** if paced work segments |
| 2 | `syncActivityDetailToLinkedWorkout` → `parseActivityToSegmentExecution` | same file → `activity-to-segment-execution.ts` | If no `detailData`: **return, no log**. Column unchanged. |
| 3 | `clearWorkoutSegmentExecution` | `activity-to-segment-execution.ts` | **Always nulls** the column first |
| 4a | `mutateSegmentExecution` | same | Rewrite as mean of work-segment deltas if any |
| 4b | `recordAlignmentFailure` | same | Leave it null after the clear |
| 5 | `applyMatchCreditsFromWorkoutRow` | `apply-activity-to-workout.ts` | **Reads** the column. Does not write it. If still null, credits/log skip. |
| later | `handleActivityDetail` → `parseMatchedActivityToSegmentExecution` | `handleActivityDetail.ts` | Runs 3–4 again. **Does not** re-run step 3 (adapt). |
| unmatch | `clearActivityFromWorkout` | `apply-activity-to-workout.ts` | Null. Correct. |
| dead | `evaluateLapSegments` | `evaluate-lap-segments.ts` | Old writer (`target − lap`). **Not on the webhook.** `@deprecated`. |

Ghost noun (do not confuse):

- `training-hydrate-service` / `race-projection.ts` also have a field named `paceDeltaSecPerMile`. That is **goal race pace − projected race pace**, not this column.

---

## Trace — when the webhook actually hits Writer B

Garmin sends two events. They race.

```text
ACTIVITY_SUMMARY
  create athlete_activities          ← raw activityId
  tryMatch → applyActivityToWorkout
    Writer A (or skip)
    bolt if detailData exists        ← almost never on summary
    ADAPT / credits                  ← reads column, often null

ACTIVITY_DETAIL (later, or first)
  persist detailData
  if row already existed:
    maybe match again
    then parseMatchedActivityToSegmentExecution  ← Writer B
    adaptive is NOT called
  if detail created the row:
    hydration FIRST (NO_WORKOUT, silent)
    then match (Writer A + bolt can succeed because detail is on the row)
```

Concurrent: yes, the **webhooks** are concurrent. Step 2 is not. Bolt only when `matchedActivityId` and `detailData` both exist. Analyze only after bolt. Today adapt is tied to match, not to the delta write.

---

## Why +/- disappeared after it worked

History, not mythology:

1. **`b878f0e`** — bolt service created. Column is the SOT after laps assign.
2. **`31fadd6`** — Intervals/Tempo require 1:1 lap → segment row. Misaligned → skip scoring.
3. **`70c4358` / `c1af675`** — display-time `computeWorkoutPerformanceAnalysis` becomes a **second brain**. Structured types go `completion_only` unless `structuredSegmentLapsAligned()` (exactly one lap per segment row).
4. **`e47e4ef`** — Writer A stops writing whole-run delta when paced work segments exist. Correct for structured. Credits still fire on that same call.

So a finished Tempo/Intervals workout can be `MATCHED`, notification sent, and:

- column null (Writer A skipped, Writer B never ran or cleared and failed)
- or column written by Writer B, and GET still hides +/- because display re-gates harder than the writer

Mobile also hardcodes `showWorkoutLevelPaceComparison = false` in `WorkoutPerformancePanel`. That is display, not analyze — but it looks like “deltas are gone.”

---

## Stone rules for anyone touching this

1. **`workouts.paceDeltaSecPerMile` is the analyzed result.** Sign is `target − actual`. Do not flip it. Do not replace it with a display-only number unless you write that number back.

2. **Writer B may overwrite Writer A.** That is allowed only when laps actually bolted. If bolt cannot run (`NO_DETAIL`, `NO_WORKOUT`), **do not clear the column.**

3. **`clearWorkoutSegmentExecution` must not wipe a live delta on a failed parse.** Failed alignment may record `ALIGNMENT_FAILED`. It must not pretend the workout was never analyzed if Writer A already had a legal easy/long-run delta.

4. **Adapt reads this column and only this column** for “how did they run vs target.” Do not call adaptive until step 2 has written or explicitly said “pending detail.”

5. **Display reads the column and the bolted segment actuals.** `computeWorkoutPerformanceAnalysis` may format. It may not invent a third eligibility that hides a written delta.

6. **Do not revive `evaluate-lap-segments.ts`.** Dead writer. Bolt path is `parseActivityToSegmentExecution`.

7. Same-name `paceDeltaSecPerMile` on race projection is a different noun. Do not merge them.

---

## File index (step 2 only)

| Path | Role |
|------|------|
| `prisma/schema.prisma` (`workouts.paceDeltaSecPerMile`) | SOT column + sign comment |
| `lib/training/apply-activity-to-workout.ts` | Writer A + credit reader |
| `lib/training/activity-to-segment-execution.ts` | Writer B + the wipe |
| `lib/garmin-events/handleActivityDetail.ts` | Later bolt; no adapt re-run |
| `lib/training/workout-performance-analysis.ts` | Display-time ghost analyzer |
| `lib/training/evaluate-lap-segments.ts` | Deprecated writer |
| `lib/training/light-adaptive-service.ts` | Step 3 reader (gate on delta) |
| `lib/training/pace-comparison-display.ts` | Phrase only |

---

## Verify a live row before changing code

On a finished workout:

```text
matchedActivityId
targetPaceSecPerMile
actualAvgPaceSecPerMile
paceDeltaSecPerMile          ← if this was ever set and is now null, someone wiped it
evaluationEligibleFlag
segmentExecutionStatus       ← ALIGNED | ALIGNMENT_FAILED | null
segmentExecutionLapCount
segments[].actualPaceSecPerMile
segments[].segment_laps
```

If `segmentExecutionStatus` is `ALIGNMENT_FAILED` and `paceDelta` is null, that is the wipe, not “we never had deltas.”
