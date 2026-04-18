# Workout Card Mental Model

## The Question the Card Must Answer

"Did the athlete do this workout today, and if so what happened?"

There are exactly three states:

```
State A: DONE     — workouts row has matchedActivityId (auto-match already fired)
State B: PENDING  — workouts row unmatched BUT a Garmin activity exists on this date
State C: PLANNED  — no Garmin activity on this date yet (haven't gone yet, or not synced)
```

Service 1 resolves State A.
Service 2 resolves State B (fallback when auto-match has not fired).

---

## How the Data Gets There (existing pipeline)

```
Garmin (webhook or manual sync)
  → creates athlete_activities row
  → tryMatchActivityToTrainingWorkout() runs
      → finds workouts row (by garminWorkoutId OR same UTC date)
      → writes actuals onto workouts row:
          matchedActivityId
          actualDistanceMeters
          actualAvgPaceSecPerMile
          actualAverageHeartRate
          actualDurationSeconds
          paceDeltaSecPerMile       (target - actual, positive = faster)
          targetPaceSecPerMile
          hrDeltaBpm
          creditedFiveKPaceSecPerMile
      → marks athlete_activities.ingestionStatus = MATCHED
```

After this runs, the workouts row IS the source of truth. It has everything.
The athlete_activities row is just the raw input — it is not what the UI reads.

---

## Service 1: Workout Has Actual Data

**What it is:** Read the workouts row. Check if matchedActivityId is set.

**API (already exists):** GET /api/training/workout/[id]
Returns the full workouts row including matched_activity, paceDeltaSecPerMile, all actuals.

**What the card shows when State A:**
- Title: "Easy 7.5 mi — Done"
- Actual distance, pace, duration
- vs plan: "+12 sec/mi faster than target" or "missed by 8 sec/mi"
- HR vs target if available
- Link: "Full breakdown" -> /workouts/[id]

No Service 2 needed if matchedActivityId is set.

---

## Service 2: Garmin Activity Exists But No Match Yet (Fallback)

**When it triggers:** workouts row has NO matchedActivityId, but there IS an athlete_activities row for the same date.

**New API needed:** GET /api/athlete/activities-for-date?date=YYYY-MM-DD
- Queries athlete_activities WHERE athleteId = X AND startTime between day start and end
- Returns list: id, activityName, startTime, distance, averageSpeed, duration
- Excludes rows already matched (ingestionStatus = MATCHED) to avoid duplicates

**What the card shows when State B:**
- "We see a Garmin run from today — is this your workout?"
- Row per activity: time, distance, pace (computed from averageSpeed)
- Button: "Yes, this is it" -> POST /api/workouts/[id]/match-activity { activityId }
  -> calls tryMatchActivityToTrainingWorkout with forced workoutId
  -> returns updated workouts row
  -> card transitions to State A (re-renders with actual data)

---

## The Detection Problem (Staleness)

The card cannot show State C forever just because it loaded that way.
The user might have gone for a run after the page loaded.

**Detection strategy: poll on visibility + explicit refresh**

1. On page load: check State A first (read workouts row)
2. If State C: show the plan card + a "Sync Garmin" button
3. On "Sync Garmin" tap:
   - POST /api/garmin/sync (already exists — pulls last 30 days from Garmin API)
   - After sync completes, re-fetch the workouts row
   - If matchedActivityId now set: transition to State A card
   - If still unmatched but athlete_activities rows now exist for today: transition to State B card
4. Optional: poll every 30s if page is visible and state is still C

**Why poll matters:** The webhook from Garmin fires asynchronously. By the time the athlete opens the app post-run, the webhook may have already fired and the workouts row already has actuals. So the FIRST read on page load may already be State A — no Garmin sync needed at all.

---

## What "last workout" means

GET /api/me/last-logged-workout (already exists):
- Queries workouts WHERE matchedActivityId IS NOT NULL ORDER BY updatedAt DESC LIMIT 1
- Returns the workouts row (not athlete_activities)
- This is correct — the workouts row has all the enriched fields

This is NOT the same as "last Garmin activity". It is the last PLAN workout that was matched.

If the athlete does a run that has no workouts row (no plan, no standalone workout created),
it will NOT appear here. It will only be in athlete_activities.

That is an acceptable gap for now: the plan-based flow is the primary case.

---

## Endpoint Summary

| Purpose | Endpoint | Status |
|---|---|---|
| Read workout with actuals | GET /api/training/workout/[id] | Exists |
| Last matched workout | GET /api/me/last-logged-workout | Exists |
| Garmin activities for a date | GET /api/athlete/activities-for-date?date= | NEEDS BUILDING |
| Manually match activity to workout | POST /api/workouts/[id]/match-activity | NEEDS BUILDING |
| Trigger Garmin sync | POST /api/garmin/sync | Exists |

---

## Card State Machine

```
Page loads
  -> fetch workouts row for today's workout
  -> if matchedActivityId set: render DONE card (State A)
  -> else: fetch athlete_activities for today
      -> if any exist (unmatched): render PENDING card (State B)
      -> else: render PLANNED card (State C) + Sync Garmin button

User taps "Sync Garmin" (State C only)
  -> POST /api/garmin/sync
  -> re-fetch workouts row
  -> if matched: -> State A
  -> else re-fetch athlete_activities for today
  -> if any: -> State B
  -> else: stay State C ("Haven't gone yet")

User taps "Yes this is it" (State B)
  -> POST /api/workouts/[id]/match-activity { activityId }
  -> -> State A (render DONE card with returned actuals)
```
