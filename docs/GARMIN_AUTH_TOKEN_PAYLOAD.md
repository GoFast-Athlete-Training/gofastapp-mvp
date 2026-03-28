# Garmin Auth Token Payload (Current State)

This document describes the **current** Garmin auth/token shape used by GoFast for workout pushes.

## 1) Athlete DB fields used for Garmin auth

From the `Athlete` model, token/identity fields are:

- `garmin_user_id` (canonical Garmin identity in our system)
- `garmin_access_token` (OAuth access token; eval or production depending on `GARMIN_CLIENT_ID` used at connect time)
- `garmin_refresh_token`
- `garmin_expires_in` (seconds lifetime; metadata)
- `garmin_connected_at`

## 2) Outbound auth header for workout push

Current request to Garmin Training API:

- URL: `POST https://apis.garmin.com/training-api/workout`
- Headers:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`

The app never sends internal `athlete.id` as a Garmin identity field.

## 3) Access token format observed

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

## 4) Token refresh behavior

On HTTP **401**, callers may invoke `refreshGarminToken(athleteId)` once and retry using `GARMIN_CLIENT_ID` / `GARMIN_CLIENT_SECRET` with the stored `garmin_refresh_token`.

## 5) Training API auth mode support

Workout push supports:

- `GARMIN_TRAINING_AUTH_MODE=bearer` (default): `Authorization: Bearer <garmin_access_token>`.
- `GARMIN_TRAINING_AUTH_MODE=oauth1`: `Authorization: OAuth ...` (HMAC-SHA1). Requires:
  - `GARMIN_TRAINING_OAUTH_CONSUMER_KEY`
  - `GARMIN_TRAINING_OAUTH_CONSUMER_SECRET`
  - `GARMIN_TRAINING_OAUTH_TOKEN_SECRET`  
  Uses `garmin_access_token` as `oauth_token`.

## 6) Data model gap analysis

For strict per-athlete OAuth1 support, we currently **do not store**:

- `oauth_token_secret` on `Athlete`

Current implementation uses a global env token secret in OAuth1 mode to avoid a schema break.

If Garmin requires user-scoped token secrets, add this field:

- `garmin_oauth_token_secret String?` on `Athlete`
