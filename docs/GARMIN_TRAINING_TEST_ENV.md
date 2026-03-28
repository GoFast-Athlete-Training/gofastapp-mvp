# Garmin eval / sandbox vs production

There is a **single** OAuth integration: `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, callback `GET /api/auth/garmin/callback`, and athlete fields `garmin_access_token`, `garmin_refresh_token`, `garmin_user_id`, etc.

To exercise **Garmin’s developer / evaluation app**, point those two env vars at the eval app in that deployment (and register the same callback URL on the eval app). To use production Garmin credentials, swap the values on the environment where you deploy. No separate `garmin_test_*` database columns or `/api/auth/garmin-test/*` routes.

See also: Settings → Garmin Connect (`/settings/garmin`).
