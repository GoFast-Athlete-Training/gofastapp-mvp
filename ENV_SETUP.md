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

Set your PostgreSQL connection string:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/gofast
```

## Garmin OAuth (Optional)

```bash
GARMIN_CLIENT_ID=your_client_id
GARMIN_CLIENT_SECRET=your_client_secret
GARMIN_REDIRECT_URI=http://localhost:3000/settings/garmin/callback
```

## App URL

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

