# Athlete activity history (training context)

Training flexibility features (`loadRecentRunLoad`, day brief) read **`athlete_activities`** — not a separate Strava table.

## Today

- **Garmin** is the primary ingest: webhooks and Cloud Run `garmin-activity-detail-ingest` write rows with `source` default `"garmin"`.
- Columns used for load summaries: `startTime`, `distance`, `duration`, `averageSpeed`, `activityType`, `activityName`.

## Strava (future)

No Strava OAuth in the athlete training app yet. When added, new activities should upsert into the same `athlete_activities` row shape:

- `source: "strava"`
- `sourceActivityId` = Strava activity id
- Same numeric fields as Garmin for distance/duration/pace

`loadRecentRunLoad` is **source-agnostic** — it filters run-like `activityType` values and does not branch on `source`.

## Manual history

Athlete preset creation still accepts free-text `trainingHistory` for blueprint inference; that path is separate from synced activities.
