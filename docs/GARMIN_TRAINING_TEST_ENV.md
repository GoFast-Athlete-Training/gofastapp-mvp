# Garmin training / test mode (environment variables)

Production OAuth uses `GARMIN_CLIENT_ID` and `GARMIN_CLIENT_SECRET` (refresh flow in `lib/garmin-refresh-token.ts`).

For **sandbox or evaluation** credentials, tokens are stored on the **Athlete** row (not only in env):

## Production: apply DB migrations

If logs show **`P2022`** / `The column Athlete.garmin_test_linked_email does not exist`, production never ran the migration that adds that column. Apply migrations using the **same** `DATABASE_URL` as your deployed app:

```bash
cd gofastapp-mvp
export DATABASE_URL='postgresql://...'   # production connection string
npm run prisma:migrate
# equivalent: npx prisma migrate deploy --schema=./prisma/schema.prisma
```

**Manual SQL** (Postgres), if you cannot run Prisma from CI:

```sql
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "garmin_test_linked_email" TEXT;
```

Then mark the migration as applied so future `migrate deploy` stays in sync:

```bash
npx prisma migrate resolve --applied 20260328120000_athlete_garmin_test_linked_email --schema=./prisma/schema.prisma
```

| DB field | Purpose |
|----------|---------|
| `garmin_test_access_token` | Bearer token for API calls when test mode is on |
| `garmin_test_user_id` | Garmin `userId` sent on webhooks — must match for `getAthleteByGarminUserId` |
| `garmin_use_test_tokens` | When `true`, `getValidAccessToken` returns test token (no refresh) |
| `garmin_test_linked_email` | Optional label (e.g. test Garmin login email); never touches prod columns |

## Test OAuth (recommended vs portal copy-paste)

Use **Connect Garmin (test app)** on `/settings/garmin` or call:

- `GET /api/auth/garmin-test/authorize?athleteId=<cuid>` → opens Garmin consent with `GARMIN_TEST_CLIENT_ID`
- Callback: `GET /api/auth/garmin-test/callback` (register this URL on the **test** Garmin app)

Writes **only** `garmin_test_access_token`, `garmin_test_user_id`, `garmin_use_test_tokens`, and optionally `garmin_test_linked_email` from `GARMIN_TEST_LINKED_ACCOUNT_EMAIL`. Does **not** update `garmin_user_id`, `garmin_access_token`, `garmin_refresh_token`, or `garmin_is_connected`.

## Recommended env names (for scripts / local setup)

| Variable | Used by |
|----------|---------|
| `GARMIN_TRAINING_TEST_ACCESS_TOKEN` | `scripts/set-test-garmin-token.ts` — written to `garmin_test_access_token` |
| `GARMIN_TRAINING_TEST_USER_ID` | Same script — written to `garmin_test_user_id` |
| `GARMIN_TRAINING_TEST_ATHLETE_ID` | Optional — target athlete `id` (cuid) |
| `GARMIN_TRAINING_TEST_ATHLETE_EMAIL` | Optional — substring match on `athlete.email` |
| `GARMIN_TEST_CLIENT_ID` | Test OAuth app — `garmin-test/authorize` |
| `GARMIN_TEST_CLIENT_SECRET` | Test OAuth app — token exchange |
| `GARMIN_TEST_LINKED_ACCOUNT_EMAIL` | Optional — saved to `garmin_test_linked_email` on successful test OAuth |

Example `.env.local` (never commit real tokens):

```bash
GARMIN_CLIENT_ID=...
GARMIN_CLIENT_SECRET=...

# Sandbox / evaluation (optional)
GARMIN_TRAINING_TEST_ACCESS_TOKEN=your_eval_bearer_token
GARMIN_TRAINING_TEST_USER_ID=1234567890
# GARMIN_TRAINING_TEST_ATHLETE_ID=clxxxxxxxx
```

## Apply test token to your user

```bash
cd gofastapp-mvp
# Load .env.local automatically if you use dotenv in shell, or:
export GARMIN_TRAINING_TEST_ACCESS_TOKEN=...
export GARMIN_TRAINING_TEST_USER_ID=...
npx tsx scripts/set-test-garmin-token.ts
```

## Webhook resolution

`getAthleteByGarminUserId` now checks:

1. `Athlete.garmin_user_id` (production OAuth)
2. Else `Athlete.garmin_test_user_id` (test)

So webhook `userId` must equal the stored test user id when using sandbox.

## UI “connected” state

The athlete API strips secret tokens from JSON. The app treats `garmin_use_test_tokens === true` as “training test mode enabled” for showing Garmin-connected UI alongside `garmin_is_connected`.

## Push workout — what the logs mean

- **`🧪 Using test token for athlete …`** — `getValidAccessToken` is correctly using `garmin_test_access_token` (not production OAuth refresh). This is **not** an error; it confirms test mode.
- **Training API URL** — Workout create must hit the **Training API** host path, e.g. `https://apis.garmin.com/training-api/workout` (see `lib/garmin-workouts/api-client.ts`). Posting to `https://apis.garmin.com/workout` hits the wrong route (often **404**).
- **Optional env** — `GARMIN_TRAINING_API_BASE` (default `https://apis.garmin.com/training-api`) if Garmin changes the base path.

### If push still fails after URL fix

| HTTP | Likely cause |
|------|----------------|
| **401** | Expired or invalid Bearer (renew eval token, or refresh prod token). |
| **403** | App not approved for Training API or missing scope (e.g. partner training write). |
| **404** | Wrong base path or endpoint. |
| **400 / 422** | JSON shape / enums don’t match Garmin’s schema (see `assembleGarminWorkout` payload). |

API errors from the client now include **status, full URL, and body snippet** in the thrown message (and `details` on the `500` JSON from `POST /api/workouts/[id]/push-to-garmin`).
