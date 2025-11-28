# Next.js Build Safety Audit - GoFast MVP

**Last Updated**: January 2025  
**Next.js Version**: 14.2.5  
**Project**: GoFast MVP

---

## Executive Summary

This repository follows the **Next.js 14 App Router safe patterns** for dynamic applications. All API routes are configured to prevent static evaluation failures.

**✅ Build Status**: Safe for dynamic builds on Vercel  
**❌ Static Export**: Not supported (app is fully dynamic by design)

---

## API Route Safety Patterns

### ✅ All API Routes Follow Safe Pattern

**Pattern Applied to All 13 Routes**:
```typescript
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Safe body reading
    let body = {};
    try {
      body = await request.json();
    } catch {}

    // 2. Safe token parsing
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Safe Firebase Admin check
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.warn('Firebase Admin not initialized');
      return NextResponse.json({ error: 'Auth unavailable' }, { status: 500 });
    }

    // 4. Safe token verification
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 5. Business logic (Prisma calls)
    // ...

  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

### Routes Updated

✅ `/api/athlete/create`  
✅ `/api/athlete/hydrate`  
✅ `/api/athlete/[id]` (GET & PUT)  
✅ `/api/runcrew/create`  
✅ `/api/runcrew/join`  
✅ `/api/runcrew/hydrate`  
✅ `/api/runcrew/[id]` (GET)  
✅ `/api/runcrew/[id]/runs` (GET & POST)  
✅ `/api/runcrew/[id]/messages` (GET & POST)  
✅ `/api/runcrew/[id]/announcements` (GET & POST)  
✅ `/api/garmin/auth-url`  
✅ `/api/garmin/activity`  
✅ `/api/garmin/callback`  

---

## Service Initialization

### ✅ Firebase Client SDK

**Location**: `lib/firebase.ts`  
**Type**: Client-only (`'use client'`)  
**Initialization**: 
- Uses `NEXT_PUBLIC_FIREBASE_*` environment variables
- Hardcoded fallbacks from `gofastfrontend-mvp1`
- Initialized in client components only

**✅ Build Safety**: 
- Only used in client components
- Not imported in API routes
- Safe for dynamic builds

### ✅ Firebase Admin SDK

**Location**: `lib/firebaseAdmin.ts`  
**Type**: Server-only (no `'use client'`)  
**Initialization**: 
- Uses `FIREBASE_SERVICE_ACCOUNT` environment variable
- Lazy initialization (checks if already initialized)
- Returns `null` if not configured (prevents build failures)

**✅ Build Safety**: 
- Only used in API routes (server-side)
- Not imported in pages or components
- Safe null checks prevent build-time errors
- Safe for dynamic builds

### ✅ Prisma

**Location**: `lib/prisma.ts`  
**Type**: Server-only  
**Initialization**: 
- Singleton pattern using `globalThis`
- Uses `DATABASE_URL` environment variable
- Generated via `prisma generate`

**✅ Build Safety**: 
- Only used in:
  - API routes (`/app/api/*`)
  - Domain files (`/lib/domain-*.ts`)
- Never imported in client components
- Never imported in page components
- Safe for dynamic builds

**Usage Pattern**:
```typescript
// ✅ Good: API route
import { prisma } from '@/lib/prisma';
export async function GET(request: Request) {
  const data = await prisma.athlete.findMany();
}

// ✅ Good: Domain file
import { prisma } from '@/lib/prisma';
export async function getAthleteById(id: string) {
  return prisma.athlete.findUnique({ where: { id } });
}
```

---

## Page Architecture

### ✅ All Pages Are Client Components

**Pattern**: All 18 pages use `'use client'` directive

**Pages**:
- `app/page.tsx` - Entry point (auth check)
- `app/welcome/page.tsx` - Universal hydration
- `app/home/page.tsx` - Main dashboard
- All `/runcrew/*` pages (7 pages)
- All `/activities/*` pages (2 pages)
- All `/settings/*` pages (3 pages)
- `app/profile/page.tsx`

**✅ Build Safety**: 
- Client components are dynamic by default
- All pages have `export const dynamic = 'force-dynamic'`
- Safe for dynamic builds

---

## localStorage Usage

### ✅ Safe localStorage Access

**Location**: `lib/localstorage.ts`  
**Pattern**: All methods guard with `typeof window !== 'undefined'`

```typescript
export const LocalStorageAPI = {
  setAthlete(athlete: any) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('athlete', JSON.stringify(athlete));
    }
  },
  // ... all methods guarded
};
```

**✅ Build Safety**: 
- All access guarded
- Only used in client components
- Safe for dynamic builds

---

## API Route Safety Checklist

### ✅ Applied to All Routes

- [x] `export const dynamic = 'force-dynamic'` at top
- [x] Use `Request` instead of `NextRequest`
- [x] Safe `request.json()` reading with try/catch
- [x] Safe token parsing (check `authHeader?.startsWith('Bearer ')`)
- [x] Safe Firebase Admin check (return 500 if null)
- [x] Safe token verification (try/catch, return 401 on error)
- [x] All Prisma calls wrapped in try/catch
- [x] Early returns instead of throwing
- [x] Final catch-all returns generic error

---

## Patterns to Follow

### ✅ DO: Current Patterns (Safe for Dynamic Builds)

1. **Keep all pages as client components**
   ```tsx
   'use client';
   export const dynamic = 'force-dynamic';
   export default function Page() { /* ... */ }
   ```

2. **Use API routes for data fetching**
   ```typescript
   // ✅ Good: API route
   export const dynamic = 'force-dynamic';
   export async function GET(request: Request) {
     // Safe pattern
   }
   ```

3. **Initialize Firebase in client components only**
   ```tsx
   // ✅ Good: Client component
   'use client';
   import { auth } from '@/lib/firebase';
   ```

4. **Use Prisma only in API routes and domain files**
   ```typescript
   // ✅ Good: API route or domain file
   import { prisma } from '@/lib/prisma';
   ```

5. **Guard browser APIs with `typeof window !== 'undefined'`**
   ```typescript
   // ✅ Good: Guarded
   if (typeof window !== 'undefined') {
     const data = localStorage.getItem('key');
   }
   ```

6. **Use `useEffect` for client-only code**
   ```tsx
   useEffect(() => {
     // Client-only code here
   }, []);
   ```

### ❌ DON'T: Patterns That Break Builds

1. **Don't import Prisma in pages or components**
   ```tsx
   // ❌ Bad: Prisma in client component
   'use client';
   import { prisma } from '@/lib/prisma';
   ```

2. **Don't import Firebase Admin in client components**
   ```tsx
   // ❌ Bad: Admin SDK in client
   'use client';
   import { getAdminAuth } from '@/lib/firebaseAdmin';
   ```

3. **Don't access `localStorage` in server components**
   ```tsx
   // ❌ Bad: localStorage in server component
   export default function Page() {
     const data = localStorage.getItem('key'); // Error!
   }
   ```

4. **Don't use `NextRequest` in API routes**
   ```typescript
   // ❌ Bad: NextRequest
   export async function POST(request: NextRequest) { }
   
   // ✅ Good: Request
   export async function POST(request: Request) { }
   ```

5. **Don't read `request.json()` without try/catch**
   ```typescript
   // ❌ Bad: No try/catch
   const body = await request.json();
   
   // ✅ Good: Safe try/catch
   let body = {};
   try {
     body = await request.json();
   } catch {}
   ```

---

## Build Configuration

### Current Configuration

**`next.config.mjs`**:
```javascript
const nextConfig = {
  reactStrictMode: true,
};
```

**No static export configuration** - app is dynamic by design.

### Build Command

```bash
npm run build
```

This builds a **dynamic Next.js application** that requires:
- Node.js runtime
- Database connection (for API routes)
- Environment variables

### Deployment Requirements

- **Runtime**: Node.js server (Vercel, Render, etc.)
- **Database**: PostgreSQL (for Prisma)
- **Environment Variables**:
  - `DATABASE_URL` - Prisma connection
  - `FIREBASE_SERVICE_ACCOUNT` - Firebase Admin (JSON string)
  - `NEXT_PUBLIC_FIREBASE_*` - Firebase Client (optional, has fallbacks)

---

## Summary

### ✅ What's Correct

1. **API Routes**: All 13 routes follow safe pattern
2. **Pages**: All 18 pages are client components with `force-dynamic`
3. **Services**: Properly separated (client vs server)
4. **localStorage**: All access guarded
5. **Prisma**: Only in API routes and domain files
6. **Firebase Admin**: Only in API routes with safe null checks

### ✅ Build Safety Guarantees

1. **No static evaluation** - All routes have `force-dynamic`
2. **No build-time crashes** - Safe null checks for Firebase Admin
3. **No request parsing errors** - Safe try/catch for `request.json()`
4. **No token verification errors** - Safe try/catch for token verification
5. **No Prisma in client** - Only in server-side code

### ✅ Matches Next.js 14 Safe Patterns

This app follows the exact patterns from the Next.js build safety guide:
- ✅ All API routes use `Request` not `NextRequest`
- ✅ All API routes have `export const dynamic = 'force-dynamic'`
- ✅ Safe request body parsing
- ✅ Safe token parsing
- ✅ Safe Firebase Admin initialization
- ✅ Safe error handling
- ✅ All pages are client components
- ✅ Proper service separation

---

**Last Updated**: January 2025  
**Next.js Version**: 14.2.5  
**Build Type**: Dynamic (not static)  
**Status**: ✅ Safe for dynamic builds on Vercel

