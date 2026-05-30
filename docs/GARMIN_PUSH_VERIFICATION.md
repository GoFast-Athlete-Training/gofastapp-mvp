# Garmin Push Verification Checklist

Manual end-to-end check after changing Garmin push/schedule code.

## Preconditions

- Athlete has Garmin connected (`requireGarminTokenFresh` succeeds).
- Workout is materialized with segments/steps.
- Workout has a scheduled date (or use today push).

## Send flow

1. Tap **Send to Garmin** from workout detail or today’s workout card.
2. Confirm success copy mentions **Garmin Connect calendar** and **sync your watch**.
3. Confirm API response includes both:
   - `garminWorkoutId` — workout library definition
   - `garminScheduleId` — calendar placement for the date

## Database

4. Row has `garminWorkoutId` and `garminScheduleId` populated.
5. UI shows **On Garmin Connect calendar — sync your watch** (not “In Garmin library”).

## Garmin Connect

6. Open Garmin Connect → calendar → verify workout on the expected date.
7. Sync compatible watch from Garmin Connect.
8. Confirm structured workout appears on watch for that day.

## Re-push / stale schedule

9. Re-send same workout — should delete old schedule (or tolerate 404 if stale) and create a new verified schedule id.
10. If user deleted schedule in Garmin Connect manually, re-push should still succeed and persist a new `garminScheduleId`.

## Failure modes to spot

- Success with only `garminWorkoutId` and no `garminScheduleId` → calendar not scheduled (bug).
- “In Garmin library — schedule again” with no recent push attempt → missing schedule step.
- Verify errors in logs: `Garmin calendar schedule failed` vs `Garmin calendar verification failed`.

## Bike / tri

11. Bike workout push follows same schedule-and-verify helper as run.
12. Tri run/bike legs delegate to run/bike push; swim legs remain unsupported.
