# Cloud Run Garmin Activity Detail Ingest

Large Garmin `activityDetails` payloads exceed Vercel's ~4.5 MB function body limit and are rejected before our handler runs (`FUNCTION_PAYLOAD_TOO_LARGE`). This sidecar accepts payloads up to **30 MB** (under Cloud Run's 32 MB HTTP/1 cap), archives optional raw JSON, and reuses the same DB persistence path as the Vercel route.

## Architecture

```text
Garmin Activity Details  -->  Cloud Run sidecar  -->  Postgres (Neon)
                                      |
                                      +--> optional GCS raw archive
Vercel Next.js app       -->  reads hydrated activity detail from DB
```

Shared processing lives in:

- `lib/garmin-events/process-activity-detail-webhook.ts`
- `lib/garmin-events/handleActivityDetail.ts`
- `lib/garmin-events/archive-activity-detail-payload.ts`

The Vercel route at `/api/garmin/activity-detail-webhook` remains for small Garmin tool tests and backward compatibility.

## Required env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Same pooled Neon URL used by the Next.js app |
| `PORT` | no | Defaults to `8080` (Cloud Run sets this) |
| `MAX_BODY_BYTES` | no | Defaults to `31457280` (30 MB) |
| `GCS_ARCHIVE_BUCKET` | no | If set, raw payloads archive to `gs://bucket/garmin/activity-detail/...` |
| `BLOB_READ_WRITE_TOKEN` | no | Optional Vercel Blob archive fallback |

## Local dev

From repo root:

```bash
cd services/garmin-activity-detail-ingest
npm install
export DATABASE_URL="postgresql://..."
npm run dev
```

Health check:

```bash
curl http://localhost:8080/health
```

Minimal Garmin test payload:

```bash
curl -X POST http://localhost:8080/activity-detail-webhook \
  -H "Content-Type: application/json" \
  -d '{"userId":"garmin-user-uuid","activityDetails":[{"activityId":"123456789","userId":"garmin-user-uuid"}]}'
```

## Deploy to Cloud Run

Build from **repo root** (`gofastapp-mvp`):

```bash
docker build -f Dockerfile.garmin-activity-detail-ingest -t garmin-activity-detail-ingest .
```

For Google Cloud Run continuous deploy from source, set the Dockerfile source location to:

```text
Dockerfile.garmin-activity-detail-ingest
```

That keeps the Docker build context at the app root, so the image can copy shared `lib` and `prisma` files.

Push to Artifact Registry, then deploy:

```bash
gcloud run deploy garmin-activity-detail-ingest \
  --image REGION-docker.pkg.dev/PROJECT/REPO/garmin-activity-detail-ingest:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="postgresql://..." \
  --set-env-vars GCS_ARCHIVE_BUCKET="your-bucket-name" \
  --memory 512Mi \
  --timeout 300 \
  --concurrency 10
```

Notes:

- Use the same `DATABASE_URL` as production Vercel (pooled Neon host).
- Grant the Cloud Run service account `storage.objectCreator` on the archive bucket if using GCS.
- Cloud Run URL example: `https://garmin-activity-detail-ingest-xxxxx-uc.a.run.app`

## Garmin Developer Portal

Update **Activity API → Activity Details** webhook URL to the Cloud Run endpoint:

```text
https://YOUR-CLOUD-RUN-URL/activity-detail-webhook
```

Keep these on Vercel:

- Activity Summary → `/api/garmin/webhook`
- Activity Files → `/api/garmin/webhook`
- Health (Sleeps/Dailies) → `/api/garmin/health-webhook`

Optional env override in the main app:

```bash
GARMIN_ACTIVITY_DETAIL_WEBHOOK_URI="https://YOUR-CLOUD-RUN-URL/activity-detail-webhook"
```

## Verification

Payload limit smoke test (no DB required):

```bash
cd services/garmin-activity-detail-ingest
npm run verify:payload-limits
```

After deploy:

1. Send Garmin portal minimal test → expect `200 OK` and Cloud Run logs with `Garmin activity-detail webhook received`.
2. Sync a real long activity → confirm `athlete_activities.detail_data` hydrates and matched workout lap rows update.
3. Confirm Vercel logs no longer show `FUNCTION_PAYLOAD_TOO_LARGE` for activity detail once Garmin points at Cloud Run.
