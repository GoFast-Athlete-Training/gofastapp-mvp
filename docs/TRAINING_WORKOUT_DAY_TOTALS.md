# Plan day mileage vs structured segments

## Why totals can look “short”

- **Week mileage** (e.g. 44 mi/week) is allocated across all days in `planWeeks`. A single day may list ~6–10 mi while the **Garmin / segment builder** only encodes the *quality* pieces (e.g. 2 mi at 5K effort) plus explicit warm-up / cool-down.
- **Easy volume** is often implied: before/after the main set you’re meant to jog easy to reach the day’s total. The UI surfaces **plan distance** (`estimatedDistanceInMeters` / schedule card) next to **structured distance** (sum of distance-based steps) so athletes aren’t surprised.
- **“Not a repeat”**: catalogue / progression rows may be flagged non-repeating when this instance is tied to a specific week; that is separate from interval workouts that literally say `4×800`.

## Data flow

1. **Schedule** (`PlanDayCard.estimatedDistanceInMeters`) — target for the calendar day.
2. **Workout row** (`workouts.estimatedDistanceInMeters`) — usually aligned with the day.
3. **Segments** — what gets pushed to Garmin; sum of `DISTANCE` steps × `repeatCount` is the **structured** subset.

When structured sum is materially lower than the plan total, we explain the gap as easy running, not a bug in the repeat counter.
