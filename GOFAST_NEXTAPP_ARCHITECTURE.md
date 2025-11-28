# GoFast Next.js App Architecture

**Last Updated**: November 28, 2025  
**Project**: gofastapp-mvp  
**Framework**: Next.js 14+ (App Router)

---

## 🎯 Overview

GoFast Next.js App is a canonical Next.js 14+ application built with:
- **Next.js App Router** (no middleware, no route groups)
- **Firebase Client SDK** for authentication
- **Firebase Admin SDK** for server-side token verification
- **Prisma** for database access (lazy-loaded)
- **Axios** for client-side API requests (with Firebase token interceptor)
- **LocalStorage** for client-side data caching/hydration
- **PostgreSQL** database (Prisma Accelerate)

---

## 📁 Project Structure

```
gofastapp-mvp/
├── app/
│   ├── page.tsx                    # ROOT: Splash + Sign-in UI
│   ├── athlete-welcome/
│   │   └── page.tsx                # Universal hydration + "Let's Train!" button
│   ├── home/
│   │   └── page.tsx                # Dashboard (secondary hydration)
│   ├── profile/
│   │   └── page.tsx                # Profile setup (new users)
│   ├── runcrew/
│   │   ├── page.tsx                # Join/create landing
│   │   ├── [id]/
│   │   │   ├── page.tsx            # Member dashboard
│   │   │   ├── admin/
│   │   │   │   └── page.tsx        # Admin dashboard
│   │   │   └── runs/[runId]/
│   │   │       └── page.tsx        # Run details
│   │   ├── create/
│   │   │   └── page.tsx            # Create crew
│   │   └── join/
│   │       └── page.tsx             # Join crew
│   ├── activities/
│   │   ├── page.tsx                # Activities list
│   │   └── [id]/
│   │       └── page.tsx            # Activity details
│   ├── settings/
│   │   ├── page.tsx                # Settings home
│   │   └── garmin/
│   │       ├── page.tsx            # Garmin connect
│   │       ├── callback/
│   │       │   └── page.tsx        # OAuth callback
│   │       └── success/
│   │           └── page.tsx        # Success page
│   └── api/
│       ├── athlete/
│       │   ├── create/
│       │   │   └── route.ts        # Create/find athlete
│       │   ├── hydrate/
│       │   │   └── route.ts        # Universal hydration
│       │   └── [id]/
│       │       └── route.ts        # Get athlete by ID
│       ├── runcrew/
│       │   ├── create/
│       │   │   └── route.ts        # Create crew
│       │   ├── join/
│       │   │   └── route.ts        # Join crew
│       │   ├── hydrate/
│       │   │   └── route.ts        # Crew hydration
│       │   └── [id]/
│       │       ├── route.ts        # Get crew
│       │       ├── runs/
│       │       │   └── route.ts    # Get crew runs
│       │       ├── messages/
│       │       │   └── route.ts    # Get crew messages
│       │       └── announcements/
│       │           └── route.ts    # Get crew announcements
│       └── garmin/
│           ├── auth-url/
│           │   └── route.ts        # Get Garmin OAuth URL
│           ├── callback/
│           │   └── route.ts        # Handle OAuth callback
│           └── activity/
│               └── route.ts        # Webhook for activities
├── lib/
│   ├── prisma.ts                   # Lazy-loaded Prisma client
│   ├── firebase.ts                 # Firebase client SDK
│   ├── firebaseAdmin.ts            # Firebase Admin SDK (server-only)
│   ├── api.ts                      # Axios instance with token interceptor
│   ├── auth.ts                     # Firebase auth helpers
│   ├── localstorage.ts            # LocalStorage API
│   ├── domain-athlete.ts           # Athlete business logic
│   ├── domain-runcrew.ts           # RunCrew business logic
│   └── domain-garmin.ts            # Garmin business logic
├── components/
│   └── RunCrew/
│       ├── RunCard.tsx
│       ├── Leaderboard.tsx
│       ├── MemberCard.tsx
│       ├── MessageFeed.tsx
│       ├── AnnouncementCard.tsx
│       └── RSVPButton.tsx
├── prisma/
│   └── schema.prisma               # Database schema
├── scripts/
│   └── upsert-company.ts           # Upsert GoFast company
└── public/
    └── logo.jpg                    # GoFast logo
```

---

## 🔄 Authentication & User Flow

### Current Flow (⚠️ MISSING ATHLETE CREATION)

```
1. User visits / (root)
   ├── Shows splash (1 second)
   ├── Checks Firebase auth
   └── If authenticated → redirects to /athlete-welcome
   └── If not authenticated → shows sign-in UI

2. User signs in (Google or Email)
   ├── Firebase creates/authenticates user
   ├── onAuthStateChanged fires
   └── Redirects to /athlete-welcome
   ❌ PROBLEM: No athlete creation here!

3. /athlete-welcome
   ├── Calls POST /api/athlete/hydrate
   ├── If 404 (athlete not found) → shows button anyway
   └── Button routes to /profile or /home
   ❌ PROBLEM: Athlete never gets created!
```

### ❌ **CRITICAL ISSUE: Missing Athlete Creation**

**Current Problem:**
- User signs in with Firebase ✅
- User gets redirected to `/athlete-welcome` ✅
- `/athlete-welcome` calls `/api/athlete/hydrate` ✅
- If athlete doesn't exist → returns 404 ❌
- **Athlete is NEVER created!** ❌

**What Should Happen:**
After Firebase sign-in, we should call `/api/athlete/create` to create/find the athlete BEFORE going to `/athlete-welcome`.

**Reference from gofastfrontend-mvp1:**
```javascript
// After Firebase sign-in:
const result = await signInWithGoogle();
const firebaseToken = await auth.currentUser.getIdToken();

// Call backend to create/find athlete
const res = await api.post("/athlete/create", {
  email: result.email,
  firstName: result.displayName?.split(' ')[0],
  lastName: result.displayName?.split(' ')[1]
});
```

---

## 🔌 API Routes

### Authentication Pattern

**ALL API routes follow this pattern:**

```typescript
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Parse body safely
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    // 2. Get auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Initialize Firebase Admin
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ success: false, error: 'Auth unavailable' }, { status: 500 });
    }

    // 4. Verify token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;

    // 5. Business logic (call domain functions)
    // ...

    // 6. Return response
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
```

### Key API Routes

#### `POST /api/athlete/create`
- **Purpose**: Create or find athlete
- **Auth**: Required (Firebase token)
- **Body**: `{ email, firstName?, lastName? }`
- **Logic**: 
  - Finds by `firebaseId` first
  - If not found, finds by `email`
  - If still not found, creates new athlete
- **Returns**: `{ athlete }`

#### `POST /api/athlete/hydrate`
- **Purpose**: Universal athlete hydration
- **Auth**: Required (Firebase token)
- **Body**: None (uses Firebase UID from token)
- **Returns**: 
  ```json
  {
    "success": true,
    "athlete": {
      "id": "...",
      "firebaseId": "...",
      "email": "...",
      "runCrews": [...],
      "weeklyActivities": [...],
      "weeklyTotals": {...}
    },
    "weeklyActivities": [...],
    "weeklyTotals": {...}
  }
  ```
- **Or**: `{ success: false, error: "..." }` (404 if not found)

#### `POST /api/runcrew/hydrate`
- **Purpose**: Secondary hydration for primary crew
- **Auth**: Required
- **Body**: `{ runCrewId }`
- **Returns**: `{ success: true, runCrew: {...} }`

---

## 💾 Data Flow & Hydration

### Two-Stage Hydration Model

#### Stage 1: Universal Hydration (`/athlete-welcome`)
- **Endpoint**: `POST /api/athlete/hydrate`
- **Stores in localStorage**:
  - `athlete` (full object)
  - `crews` (from `athlete.runCrews`)
  - `weeklyActivities`
  - `weeklyTotals`
  - `hydrationTimestamp`

#### Stage 2: Crew Hydration (`/home`)
- **Endpoint**: `POST /api/runcrew/hydrate`
- **Stores in localStorage**:
  - `primaryCrew` (full crew object with members, messages, etc.)

### LocalStorage API

```typescript
LocalStorageAPI.setAthlete(athlete)
LocalStorageAPI.getAthlete()
LocalStorageAPI.setCrews(crews)
LocalStorageAPI.getCrews()
LocalStorageAPI.setFullHydrationModel({ athlete, weeklyActivities, weeklyTotals })
LocalStorageAPI.setPrimaryCrew(crew)
LocalStorageAPI.getPrimaryCrew()
LocalStorageAPI.setHydrationTimestamp(timestamp)
LocalStorageAPI.getHydrationTimestamp()
```

---

## 🗄️ Database Schema

### Core Models

- **Athlete**: Core identity, linked to `GoFastCompany`
- **GoFastCompany**: Single-tenant container (ID: "GoFast")
- **RunCrew**: Running crews
- **RunCrewMembership**: Junction table (athlete ↔ crew)
- **RunCrewManager**: Admin/manager roles
- **AthleteActivity**: Garmin activities
- **Training models**: Plans, phases, days, executions

### Database Connection

- **URL**: Set in `.env` as `DATABASE_URL`
- **Provider**: PostgreSQL (via Prisma Accelerate)
- **Prisma Client**: Lazy-loaded (prevents build-time errors)

---

## 🔥 Firebase Configuration

### Client SDK (`lib/firebase.ts`)
- Initialized once
- Exports `auth` for client components
- Config from environment variables

### Admin SDK (`lib/firebaseAdmin.ts`)
- Server-only (never imported in client)
- Lazy initialization
- Used in API routes for token verification

### Token Injection (`lib/api.ts`)
- Axios request interceptor
- Automatically adds `Authorization: Bearer <token>` to all requests
- Gets token from `auth.currentUser.getIdToken()`

---

## 🚨 Known Issues & Missing Features

### ❌ **CRITICAL: Missing Athlete Creation on Sign-In**

**Problem:**
- User signs in with Firebase
- Gets redirected to `/athlete-welcome`
- `/athlete-welcome` calls `/api/athlete/hydrate`
- If athlete doesn't exist → 404
- **Athlete is never created!**

**Solution Needed:**
1. After Firebase sign-in, call `/api/athlete/create` BEFORE redirecting
2. Or: Make `/api/athlete/hydrate` create athlete if not found (upsert pattern)
3. Or: Call `/api/athlete/create` in `/athlete-welcome` if hydration returns 404

**Recommended Fix:**
Update `/app/page.tsx` to call `/api/athlete/create` after successful Firebase sign-in:

```typescript
if (user) {
  // Create/find athlete first
  try {
    await api.post('/athlete/create', {
      email: user.email,
      firstName: user.displayName?.split(' ')[0],
      lastName: user.displayName?.split(' ')[1]
    });
  } catch (err) {
    console.error('Failed to create athlete:', err);
  }
  router.push('/athlete-welcome');
}
```

---

## 📝 Environment Variables

### Required (`.env`)

```bash
# Database
DATABASE_URL="postgres://..."

# Firebase Client (public)
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="..."

# Firebase Admin (server-only)
FIREBASE_SERVICE_ACCOUNT_KEY="..." # JSON string or individual fields

# API Base URL (optional)
NEXT_PUBLIC_API_URL="/api" # Defaults to /api
```

---

## 🏗️ Build & Deployment

### Build Process

1. **Prisma Generate**: Runs via `postinstall` script
2. **Next.js Build**: `npm run build`
3. **Prisma Client**: Lazy-loaded (no build-time DB connection)

### Vercel Deployment

- Set all environment variables in Vercel dashboard
- `DATABASE_URL` must be set for API routes to work
- `FIREBASE_SERVICE_ACCOUNT_KEY` must be set for token verification

---

## 🎯 Page Responsibilities

### `/` (Root/Splash)
- **Purpose**: Entry point, auth check, sign-in UI
- **No hydration**
- **Routes**: `/athlete-welcome` if authenticated, shows sign-in if not

### `/athlete-welcome`
- **Purpose**: Universal hydration + welcome screen
- **Hydration**: `POST /api/athlete/hydrate`
- **Never redirects automatically** (always shows button)
- **Routes**: `/profile` (if no gofastHandle) or `/home` (if profile complete)

### `/home`
- **Purpose**: Main dashboard
- **Reads**: localStorage (athlete, crews)
- **Hydration**: `POST /api/runcrew/hydrate` (secondary, for primary crew)
- **Shows**: Dashboard with RunCrews, activities, settings

### `/profile`
- **Purpose**: Profile setup for new users
- **Updates**: Athlete profile (gofastHandle, etc.)

---

## 🔧 Domain Functions

### `lib/domain-athlete.ts`
- `getAthleteById(id)`
- `getAthleteByFirebaseId(firebaseId)`
- `createAthlete(data)`
- `hydrateAthlete(athleteId)` - Returns raw Prisma objects
- `updateAthlete(athleteId, data)`

### `lib/domain-runcrew.ts`
- `createCrew(data)`
- `joinCrew(joinCode, athleteId)`
- `hydrateCrew(runCrewId, athleteId?)` - Returns raw Prisma objects
- `getCrewById(runCrewId)`
- `createRun(data)`
- `postMessage(data)`
- `postAnnouncement(data)`
- `rsvpToRun(data)`

### `lib/domain-garmin.ts`
- `getAthleteByGarminUserId(garminUserId)`

**Key Principle**: Domain functions return raw Prisma objects (no Lite types, no shaping)

---

## 📊 Current Database State

### Tables Created
- ✅ All Prisma schema tables pushed to database
- ✅ GoFastCompany record created (ID: "GoFast")

### Athlete Creation Status
- ❌ **Athletes are NOT automatically created on sign-in**
- ⚠️ **This is the critical missing piece**

---

## 🚀 Next Steps

1. **Fix athlete creation on sign-in** (CRITICAL)
2. Test full flow: Sign-in → Welcome → Home
3. Verify hydration works end-to-end
4. Test RunCrew creation/joining
5. Test Garmin integration

---

*This architecture document should be updated as the app evolves.*

