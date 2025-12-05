# Environment Variables Setup

## Firebase Client Config (Already Configured)

The Firebase client config is hardcoded in `lib/firebase.ts` with values from `gofastfrontend-mvp1`:

- **Project ID**: `gofast-a5f94`
- **API Key**: `AIzaSyCjpoH763y2GH4VDc181IUBaZHqE_ryZ1c`
- **Auth Domain**: `gofast-a5f94.firebaseapp.com`

You can override these with environment variables if needed:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Firebase Admin (Required)

You need to set up Firebase Admin credentials for server-side token verification.

### Option 1: Service Account JSON (Recommended)

Get the service account JSON from Firebase Console or from your backend's `FIREBASE_SERVICE_ACCOUNT` environment variable.

Set in `.env.local`:
```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"gofast-a5f94",...}'
```

### Option 2: Individual Fields

Set in `.env.local`:
```bash
FIREBASE_PROJECT_ID=gofast-a5f94
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gofast-a5f94.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Database

Set your PostgreSQL connection string. For Prisma Accelerate (recommended):
```bash
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19DUVRFOGVuWE1ZWExabWNkRXUxZDMiLCJhcGlfa2V5IjoiMDFLQjM0NjRSVEVCOEo0VzJFUUowNDk3M1IiLCJ0ZW5hbnRfaWQiOiIyOWY0MTAyYmFhOGNiOTQ1NTcxNTM0MzczOTkyYWQyNGJjNTI3OTNjMzQ1OTlhMmE2MmQ5MmUzYTNmNmRmMmQ5IiwiaW50ZXJuYWxfc2VjcmV0IjoiZWFkYzM3NTYtMjA1Yi00MjM0LWIxNGItMGRjMDE0YjJjNDhmIn0.rQqjhZKvmJ4IEZwPzs8xNInnv6vHHjrswP-HmA-F5cI"
```

Or use direct PostgreSQL connection:
```bash
DATABASE_URL="postgres://29f4102baa8cb945571534373992ad24bc52793c34599a2a62d92e3a3f6df2d9:sk_CQTE8enXMYXLZmcdEu1d3@db.prisma.io:5432/postgres?sslmode=require"
```

## Garmin OAuth (Required for Garmin Integration)

### Production Credentials (GoFast Render Stack)

```bash
# Production Garmin OAuth 2.0 Credentials
GARMIN_CLIENT_ID="PRODUCTION_CLIENT_ID"
GARMIN_CLIENT_SECRET="PRODUCTION_CLIENT_SECRET"

# OAuth Callback URL (must match Garmin Developer Portal settings)
GARMIN_REDIRECT_URI="https://gofast.gofastcrushgoals.com/api/auth/garmin/callback"

# Webhook URL for Garmin activity data push
GARMIN_WEBHOOK_URI="https://gofast.gofastcrushgoals.com/api/garmin/webhook"

# Debug mode (set to "true" to enable detailed webhook logging)
GARMIN_DEBUG="false"

# Optional: Token secrets for additional security (if needed)
GARMIN_USER_ACCESS_TOKEN_SECRET=""
GARMIN_USER_REFRESH_TOKEN_SECRET=""
```

**Important**: 
- The `GARMIN_REDIRECT_URI` and `GARMIN_WEBHOOK_URI` must be registered in your Garmin Developer Portal.
- Use production credentials from the "GoFast Render Stack" Garmin application.
- Set `GARMIN_DEBUG="true"` in development to see detailed webhook payloads.

## App URL

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Server URL (Required for Garmin OAuth)

**CRITICAL**: This must be set in Vercel production environment variables.

```bash
# Production (Vercel) - REQUIRED
SERVER_URL=https://gofast.gofastcrushgoals.com
```

**Why it's needed:**
- Used to build the `redirect_uri` for Garmin OAuth callback: `${SERVER_URL}/api/auth/garmin/callback`
- Used to build the webhook URL: `${SERVER_URL}/api/garmin/webhook`
- Must match exactly what's registered in Garmin Developer Portal
- Production must ALWAYS use `SERVER_URL` (no localhost fallbacks)

**Fallback Priority (for Vercel preview deployments only):**
1. `SERVER_URL` (production must set this)
2. `NEXT_PUBLIC_APP_URL` (fallback for preview deployments)
3. `https://${VERCEL_URL}` (automatic Vercel preview URL)

**Vercel Setup:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `SERVER_URL` = `https://gofast.gofastcrushgoals.com`
3. Ensure it's set for **Production** environment
4. Redeploy if needed

**Important**: Production deployments will fail if `SERVER_URL` is not set.

