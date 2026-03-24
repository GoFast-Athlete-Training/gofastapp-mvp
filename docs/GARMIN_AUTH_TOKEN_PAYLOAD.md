# Garmin Auth Token Payload (Current State)

This document describes the **current** Garmin auth/token shape used by GoFast for workout pushes.

## 1) Athlete DB fields used for Garmin auth

From the `Athlete` model, token/identity fields are:

- `garmin_user_id` (canonical Garmin identity in our system)
- `garmin_access_token` (production access token)
- `garmin_refresh_token` (production refresh token)
- `garmin_expires_in` (seconds lifetime for production token)
- `garmin_connected_at` (timestamp used to evaluate production token expiry)
- `garmin_test_access_token` (test/eval token)
- `garmin_test_user_id` (test webhook identity mapping)
- `garmin_use_test_tokens` (feature flag to prefer test token mode)

## 2) Outbound auth header for workout push

Current request to Garmin Training API:

- URL: `POST https://apis.garmin.com/training-api/workout`
- Headers:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`

The app never sends internal `athlete.id` as a Garmin identity field.

## 3) Current token payload formats observed

### Production token (`garmin_access_token`)

Observed format: **JWT-like token** (`header.payload.signature`).

Example payload (decoded from one observed token, redacted):

```json
{
  "managed_status": "DEFAULT",
  "scope": ["PARTNER_WRITE", "PARTNER_READ", "CONNECT_READ", "CONNECT_WRITE"],
  "iss": "https://diauth.garmin.com",
  "client_type": "PARTNER",
  "exp": 1768951100,
  "iat": 1768864700,
  "garmin_guid": "8c609aa4-a9ef-4bd4-9a44-2370709b4915",
  "jti": "f0e35c59-1598-4718-8e32-6865c8ed2539",
  "client_id": "83be27fa-331c-4c02-acb6-37cce6c358a7"
}
```

Notes:
- This payload is token metadata/claims, not the workout request body.
- `exp`/`iat` are epoch timestamps.

### Test token (`garmin_test_access_token`)

Observed format: **opaque string**, for example:

- `CCPT1772536776.VI7K5M1Mgv0`
- `CPT1774379313.UKASF42e33g`

Notes:
- Not JWT payload-decodable in our app (treated as opaque bearer token).
- Empirically appears short-lived (about 24 hours in current testing).

## 4) Token mode selection behavior (current code)

When pushing workouts:

1. If `garmin_use_test_tokens=true` and `garmin_test_access_token` exists, app tries **test token** first.
2. If Garmin returns `Unable to read oAuth header` in test mode, app retries once with **production** token flow.
3. Production token flow can refresh using `garmin_refresh_token` if expired.

## 5) Known Garmin response currently seen

For current test tokens on training push:

```json
{"errorMessage":"Unable to read oAuth header"}
```

This indicates Garmin is rejecting auth parsing/contract for that credential context, before workout payload validation.

## 6) Training API auth mode support (new)

Workout push now supports two explicit auth modes:

- `GARMIN_TRAINING_AUTH_MODE=bearer` (default)
  - Sends `Authorization: Bearer <token>`
  - Supports current test-token flow + production fallback on known Garmin header parse error.

- `GARMIN_TRAINING_AUTH_MODE=oauth1`
  - Sends `Authorization: OAuth ...` header (HMAC-SHA1 signed)
  - Requires these env vars:
    - `GARMIN_TRAINING_OAUTH_CONSUMER_KEY`
    - `GARMIN_TRAINING_OAUTH_CONSUMER_SECRET`
    - `GARMIN_TRAINING_OAUTH_TOKEN_SECRET`
  - Uses production athlete token (`garmin_access_token`) as `oauth_token`.
  - Rejects training push when `garmin_use_test_tokens=true` (test-token compatibility with OAuth1 is unknown).

## 7) Data model gap analysis

For strict per-athlete OAuth1 support, we currently **do not store**:

- `oauth_token_secret` on `Athlete`

Current implementation uses a global env token secret in OAuth1 mode to avoid a schema break.

If Garmin requires user-scoped token secrets, add this field:

- `garmin_oauth_token_secret String?` on `Athlete`
