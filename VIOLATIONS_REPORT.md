# ⚠️ BUILD SAFETY VIOLATIONS REPORT

## 🔴 CRITICAL VIOLATION #1: Top-Level PrismaClient Instantiation

**File:** `lib/prisma.ts`  
**Line:** 7  
**Violation:** `export const prisma = globalForPrisma.prisma ?? new PrismaClient();`

**Problem:**
- `new PrismaClient()` executes at TOP LEVEL when the module is imported
- This happens during Next.js build-time static evaluation
- PrismaClient tries to connect to the database during build, causing build failures
- This is the ROOT CAUSE of the Vercel build error

**Impact:**
- Every API route that imports `prisma` directly or transitively (via domain files) triggers this
- Build fails with: "Failed to collect page data for /api/athlete/create"

**Current Code:**
```typescript
// lib/prisma.ts:7
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
```

**Required Fix:**
PrismaClient must be lazy-loaded - only created when first accessed, not at import time.

---

## 🔴 CRITICAL VIOLATION #2: Domain Files Import Prisma at Top Level

**Files:**
- `lib/domain-athlete.ts` line 1: `import { prisma } from './prisma';`
- `lib/domain-runcrew.ts` line 1: `import { prisma } from './prisma';`
- `lib/domain-garmin.ts` line 1: `import { prisma } from './prisma';`

**Problem:**
- When API routes import domain functions, they transitively import prisma
- This triggers Violation #1 during build-time evaluation
- Example: `app/api/athlete/hydrate/route.ts` imports `hydrateAthlete` from `domain-athlete`, which imports `prisma`, which executes `new PrismaClient()`

**Impact:**
- All API routes that use domain functions are affected
- Build fails for any route that imports domain functions

---

## 🔴 CRITICAL VIOLATION #3: API Routes Directly Import Prisma

**Files:**
- `app/api/athlete/create/route.ts` line 4: `import { prisma } from '@/lib/prisma';`
- `app/api/garmin/activity/route.ts` line 4: `import { prisma } from '@/lib/prisma';`

**Problem:**
- Direct import of prisma causes immediate execution of `new PrismaClient()` during build
- This is the most direct path to the build failure

**Impact:**
- `/api/athlete/create` fails immediately during build
- `/api/garmin/activity` fails immediately during build

---

## ✅ VERIFIED SAFE PATTERNS

All API routes correctly have:
- ✅ `export const dynamic = 'force-dynamic'` at the top
- ✅ No top-level awaits
- ✅ No top-level Firebase Admin init (getAdminAuth() called inside handlers)
- ✅ No top-level request.json() (all wrapped in try/catch)
- ✅ All use `Request` not `NextRequest`
- ✅ All Prisma calls wrapped in try/catch (but this doesn't help if PrismaClient is created at import time)

All domain files:
- ✅ No database IO on import (functions are async, not executed at import)
- ✅ All functions accept pure arguments
- ✅ No fetches at import time

---

## 🎯 ROOT CAUSE SUMMARY

The build fails because:

1. Next.js tries to statically evaluate API routes during build
2. API routes import domain functions OR directly import prisma
3. Domain files import prisma at top level
4. `lib/prisma.ts` executes `new PrismaClient()` at top level when imported
5. PrismaClient tries to connect to database during build
6. Build fails: "Failed to collect page data for /api/athlete/create"

---

## 🔧 REQUIRED FIX

**File:** `lib/prisma.ts`

**Current (UNSAFE):**
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient(); // ❌ EXECUTES AT IMPORT TIME

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Required (SAFE):**
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  
  const client = new PrismaClient();
  
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }
  
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    return (client as any)[prop];
  },
});
```

This ensures PrismaClient is only created when first accessed (lazy loading), not at import time.

---

## 📋 VERIFICATION CHECKLIST

After fix, verify:
- [ ] `lib/prisma.ts` uses lazy loading pattern
- [ ] No `new PrismaClient()` executes at import time
- [ ] All API routes still work (they access prisma inside handlers)
- [ ] All domain files still work (they access prisma inside functions)
- [ ] Build succeeds on Vercel

