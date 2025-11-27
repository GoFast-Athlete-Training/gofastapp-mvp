# Firebase Configuration - Current State

**Last Updated**: January 2025  
**Project**: gofastapp-mvp  
**Purpose**: Document current Firebase setup and identify potential build issues

---

## Overview

The app uses Firebase for authentication with two separate SDKs:
1. **Firebase Client SDK** (`firebase`) - For client-side authentication
2. **Firebase Admin SDK** (`firebase-admin`) - For server-side token verification

---

## Firebase Client Configuration

### File: `lib/firebase.ts`

**Type**: Client-side only (`'use client'`)

**Current Configuration**:
```typescript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCjpoH763y2GH4VDc181IUBaZHqE_ryZ1c",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "gofast-a5f94.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gofast-a5f94",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "gofast-a5f94.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "500941094498",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:500941094498:web:4008d94b89a9e3a4889b3b",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CQ0GJCJLXX",
};
```

**Hardcoded Values** (from `gofastfrontend-mvp1`):
- **Project ID**: `gofast-a5f94`
- **API Key**: `AIzaSyCjpoH763y2GH4VDc181IUBaZHqE_ryZ1c`
- **Auth Domain**: `gofast-a5f94.firebaseapp.com`
- **Storage Bucket**: `gofast-a5f94.firebasestorage.app`
- **Messaging Sender ID**: `500941094498`
- **App ID**: `1:500941094498:web:4008d94b89a9e3a4889b3b`
- **Measurement ID**: `G-CQ0GJCJLXX`

**Initialization**:
```typescript
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
```

**Key Points**:
- ✅ Hardcoded values as fallbacks (works without env vars)
- ✅ Can be overridden with environment variables
- ✅ Client-side only (has `'use client'` directive)
- ✅ Singleton pattern (checks if app already initialized)

**Environment Variables** (Optional):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

---

## Firebase Admin Configuration

### File: `lib/firebaseAdmin.ts`

**Type**: Server-side only (checks `typeof window === 'undefined'`)

**Current Configuration**:
Supports **two initialization patterns**:

#### Pattern 1: Service Account JSON String (Recommended)
```typescript
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
}
```

**Environment Variable**:
```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"gofast-a5f94",...}'
```

#### Pattern 2: Individual Fields
```typescript
serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'gofast-a5f94',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};
```

**Environment Variables**:
```bash
FIREBASE_PROJECT_ID=gofast-a5f94
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gofast-a5f94.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Error Handling**:
```typescript
if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  throw new Error('Firebase Admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT or individual fields.');
}
```

**Key Points**:
- ❌ **REQUIRED** - Will throw error if not configured
- ✅ Server-side only (guarded by `typeof window === 'undefined'`)
- ✅ Singleton pattern (checks if app already initialized)
- ✅ Supports both JSON string and individual fields

**Exported Functions**:
- `getAdminAuth()` - Get Firebase Admin Auth instance (lazy initialization)
- `verifyFirebaseIdToken(token: string)` - Verifies Firebase ID tokens (server-only)
- `adminAuth` - Backward compatibility export (may be null until initialized)

**Initialization Pattern**:
- Lazy initialization (matches backend pattern)
- Only initializes when first used
- Better error messages and logging
- Handles both `project_id`/`projectId` field formats
- Validates JSON parsing with clear error messages

---

## Authentication Flow

### Client-Side Auth (`lib/auth.ts`)

**File**: `lib/auth.ts`  
**Type**: Client-side only (`'use client'`)

**Functions**:
```typescript
// Sign in with Google
export async function signInWithGoogle(): Promise<User>

// Get current user's token
export async function getToken(): Promise<string | null>
```

**Implementation**:
- Uses `signInWithPopup` with `GoogleAuthProvider`
- Returns Firebase `User` object
- `getToken()` calls `user.getIdToken()`

**Usage**:
- Used in `app/page.tsx` for sign-in button
- Returns full User object (not custom format)

**Note**: This differs from `gofastfrontend-mvp1` which returns a custom object:
```javascript
// MVP1 returns:
{ uid, email, name, photoURL }

// Current returns:
User object (Firebase SDK)
```

---

## API Token Interceptor

### File: `lib/api.ts`

**Type**: Client-side only (`'use client'`)

**Current Implementation**:
```typescript
api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Error getting Firebase token:', error);
      }
    }
    return config;
  }
);
```

**Key Points**:
- ✅ Automatically adds Firebase token to all requests
- ✅ Uses `auth` from `./firebase` (not `getAuth()`)
- ✅ Silent error handling (logs but doesn't throw)
- ✅ Base URL: `/api` (relative - same origin)

**Potential Issue**:
- Unused import: `import { getAuth } from 'firebase/auth';` (line 4) - not used, could be removed

---

## Server-Side Token Verification

### Usage in API Routes

**Pattern** (used in all API routes):
```typescript
import { verifyFirebaseIdToken } from '@/lib/firebaseAdmin';

// Extract token from Authorization header
const authHeader = request.headers.get('authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const token = authHeader.substring(7);
const decodedToken = await verifyFirebaseIdToken(token);
const firebaseId = decodedToken.uid;

// Use firebaseId to find athlete
const athlete = await getAthleteByFirebaseId(firebaseId);
```

**API Routes Using This Pattern**:
- `/api/athlete/create`
- `/api/athlete/hydrate`
- `/api/athlete/[id]`
- `/api/runcrew/create`
- `/api/runcrew/join`
- `/api/runcrew/hydrate`
- `/api/runcrew/[id]`
- `/api/runcrew/[id]/runs`
- `/api/runcrew/[id]/messages`
- `/api/runcrew/[id]/announcements`
- `/api/garmin/auth-url`

---

## Potential Build Issues

### 1. Firebase Admin Not Configured

**Error**: `Firebase Admin credentials not configured`

**Cause**: Missing `FIREBASE_SERVICE_ACCOUNT` or individual fields

**Solution**: 
- Set `FIREBASE_SERVICE_ACCOUNT` in Vercel environment variables
- Or set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

**Impact**: All API routes will fail (server-side token verification)

---

### 2. Client-Side Firebase Config

**Status**: ✅ **WORKING** - Hardcoded values as fallbacks

**Note**: Client config works without env vars, but you can override with:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- etc.

---

### 3. Unused Import in `lib/api.ts`

**Issue**: 
```typescript
import { getAuth } from 'firebase/auth';  // Line 4 - NOT USED
```

**Impact**: Minor - doesn't break build but is unnecessary

**Fix**: Remove unused import

---

### 4. Missing Environment Variables in Build

**Client-Side**: ✅ Safe - has hardcoded fallbacks

**Server-Side**: ❌ **REQUIRED** - Will throw error if missing

**Check**: Ensure `FIREBASE_SERVICE_ACCOUNT` is set in Vercel

---

## Environment Variables Checklist

### Required for Production

**Firebase Admin** (Server-side):
- ✅ `FIREBASE_SERVICE_ACCOUNT` (JSON string) **OR**
- ✅ `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

### Optional (Client-side has fallbacks)

**Firebase Client**:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### Other Required

- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL` - For OAuth callbacks (optional, defaults to localhost)

---

## Comparison with MVP1

### MVP1 (`gofastfrontend-mvp1/src/firebase.js`)

**Differences**:
1. **Persistence**: MVP1 sets `browserLocalPersistence` - Current app does NOT
2. **Provider Config**: MVP1 configures `GoogleAuthProvider` with custom parameters - Current app does NOT
3. **Return Format**: MVP1 returns custom object `{uid, email, name, photoURL}` - Current app returns Firebase `User` object
4. **Scopes**: MVP1 adds `email` and `profile` scopes - Current app does NOT

**Current App** (`lib/auth.ts`):
```typescript
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;  // Returns Firebase User object
}
```

**MVP1**:
```javascript
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    photoURL: user.photoURL
  };
}
```

---

## Recommended Fixes

### 1. Add Persistence (Optional but Recommended)

**File**: `lib/firebase.ts`

Add after `getAuth(app)`:
```typescript
import { setPersistence, browserLocalPersistence } from 'firebase/auth';

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set auth persistence:', error);
});
```

### 2. Configure Google Provider (Optional but Recommended)

**File**: `lib/auth.ts`

Update `signInWithGoogle`:
```typescript
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  
  // Configure provider
  provider.setCustomParameters({
    prompt: 'select_account' // Always show account selection
  });
  
  provider.addScope('email');
  provider.addScope('profile');
  
  const result = await signInWithPopup(auth, provider);
  return result.user;
}
```

### 3. Remove Unused Import

**File**: `lib/api.ts`

Remove:
```typescript
import { getAuth } from 'firebase/auth';  // DELETE THIS LINE
```

### 4. Ensure Firebase Admin is Configured

**For Vercel Deployment**:
1. Go to Vercel project settings
2. Add environment variable: `FIREBASE_SERVICE_ACCOUNT`
3. Value: Full JSON string from Firebase Console or backend

**Get from Backend**:
- Copy `FIREBASE_SERVICE_ACCOUNT` value from `gofastbackendv2-fall2025` Render environment variables

---

## Testing Firebase Configuration

### Client-Side Test

1. Open browser console
2. Navigate to `/`
3. Click "Sign in with Google"
4. Check console for errors
5. Verify `auth.currentUser` is set after sign-in

### Server-Side Test

1. Make authenticated API call:
```typescript
const response = await api.post('/athlete/hydrate');
```

2. Check server logs for:
   - `Firebase Admin credentials not configured` error
   - Token verification errors

### Build Test

1. Run `npm run build`
2. Check for:
   - Firebase Admin initialization errors
   - Missing environment variable errors

---

## Current Configuration Summary

| Component | Status | Configuration |
|-----------|--------|--------------|
| **Firebase Client** | ✅ Working | Hardcoded values + env var fallbacks |
| **Firebase Admin** | ⚠️ Required | Needs `FIREBASE_SERVICE_ACCOUNT` or individual fields |
| **Client Auth** | ✅ Working | Basic Google sign-in (no persistence/scopes) |
| **API Interceptor** | ✅ Working | Auto-adds token to requests |
| **Token Verification** | ⚠️ Required | Needs Admin credentials |

---

## Next Steps

1. **Set Firebase Admin credentials in Vercel**
2. **Test build locally** with `.env.local`
3. **Verify API routes work** with token verification
4. **Optional**: Add persistence and provider configuration
5. **Optional**: Remove unused import in `lib/api.ts`

---

**End of Firebase Configuration Documentation**

