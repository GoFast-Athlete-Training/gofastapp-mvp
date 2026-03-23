# Garmin training / test mode (environment variables)

Production OAuth uses `GARMIN_CLIENT_ID` and `GARMIN_CLIENT_SECRET` (refresh flow in `lib/garmin-refresh-token.ts`).

For **sandbox or evaluation** credentials, tokens are stored on the **Athlete** row (not only in env):

| DB field | Purpose |
|----------|---------|
| `garmin_test_access_token` | Bearer token for API calls when test mode is on |
| `garmin_test_user_id` | Garmin `userId` sent on webhooks — must match for `getAthleteByGarminUserId` |
| `garmin_use_test_tokens` | When `true`, `getValidAccessToken` returns test token (no refresh) |

## Recommended env names (for scripts / local setup)

| Variable | Used by |
|----------|---------|
| `GARMIN_TRAINING_TEST_ACCESS_TOKEN` | `scripts/set-test-garmin-token.ts` — written to `garmin_test_access_token` |
| `GARMIN_TRAINING_TEST_USER_ID` | Same script — written to `garmin_test_user_id` |
| `GARMIN_TRAINING_TEST_ATHLETE_ID` | Optional — target athlete `id` (cuid) |
| `GARMIN_TRAINING_TEST_ATHLETE_EMAIL` | Optional — substring match on `athlete.email` |

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
