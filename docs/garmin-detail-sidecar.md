# Garmin activity detail sidecar

Garmin sends **two** webhooks. We persist raw JSON first; parsing is a second step.

## Two hooks

| Hook | Route | Writes |
|------|-------|--------|
| **Activity Summary** | Vercel `/api/garmin/webhook` | `athlete_activities` row, `summaryData` |
| **Activity Detail** | Cloud Run `garmin-activity-detail-ingest` | same row, `detailData`, `hydratedAt` |

```text
Garmin Activity Details
    → Cloud Run garmin-activity-detail-ingest (us-east4)
    → Neon athlete_activities.detailData
    → parse → workout_segment_laps (Vercel / Look at my metrics)
```

Vercel cannot accept detail bodies (~4.5 MB cap → `FUNCTION_PAYLOAD_TOO_LARGE`). Cloud Run is the only hop for detail.

## GCP

- **Project:** GoFast (`gofast-497201`, project number `288485670558`)
- **Service:** `garmin-activity-detail-ingest`, region `us-east4`
- **Webhook URL:** `https://garmin-activity-detail-ingest-288485670558.us-east4.run.app/activity-detail-webhook`
- **Logs:** [Cloud Run logs](https://console.cloud.google.com/run/detail/us-east4/garmin-activity-detail-ingest/logs?project=288485670558)

Git push updates Vercel only. **Cloud Run must be rebuilt** when Prisma schema or `lib/` changes (`prisma generate` on current schema).

## Auth / lookup

Detail ingest resolves athlete via `getAthleteByGarminUserId(garminUserId)` → `select: { id: true }` only. Goal/race fields live on `athlete_races`; sidecar does not need them.

## Error contract (never silent)

1. Cloud Run returns **5xx** when Prisma or the Neon write fails — not `200 OK`.
2. `/health` returns **503** when recent Garmin activities have no `hydratedAt` within `DETAIL_STALE_HOURS` (default 6h).
3. Log activity id + garmin user id + Prisma error body.

## Symptom: Aug 19–30 outage

Migration `20260819230000_race_owns_goal` dropped `Athlete.primaryGoalNameSnapshot`. Cloud Run image still had a Prisma client that SELECTed that column → lookup threw before `detailData` write. Last successful hydration: **2026-08-19T15:04Z**.

Fix: `select: { id: true }` + redeploy Cloud Run revision.

## Raw columns

| Column | Source |
|--------|--------|
| `summaryData` | Vercel summary webhook |
| `detailData` | Cloud Run detail webhook |
| `hydratedAt` | Set when Cloud Run successfully writes `detailData` |

No `detailData` → no new laps. Athlete copy: contact app support (see `workouts-to-analysis.md`).
