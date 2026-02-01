# Middleware Removal Audit

**Date:** February 1, 2026  
**Status:** ✅ Removed middleware and onboarding-intent library

---

## Files Removed

1. **`middleware.ts`** - Next.js middleware that set onboarding intent cookie based on hostname
2. **`lib/onboarding-intent.ts`** - Helper library that read onboarding intent cookie (used `next/headers` which caused build errors)

---

## Files Updated

1. **`app/page.tsx`** - Removed `getOnboardingIntentClient()` usage
2. **`app/signup/page.tsx`** - Removed `getOnboardingIntentClient()` usage

---

## Impact Analysis

### What Was Removed:
- Hostname-based onboarding intent detection (`leader.*` subdomain → CLUB_LEADER)
- Cookie-based intent storage (`onboarding_intent` cookie)
- Client-side intent reading functions

### What Still Works:
- **`app/api/athlete/create/route.ts`** - Already gets `onboardingIntent` from request body (not affected)
- Signup flow - Can still pass intent via request body if needed
- Authentication flow - Unaffected

### Migration Notes:
- If onboarding intent is still needed, it should be passed explicitly in request bodies
- No automatic hostname detection anymore
- No cookie-based intent storage

---

## Build Errors Fixed

- ✅ Removed `next/headers` dependency that caused "You're importing a component that needs 'next/headers'" error
- ✅ Removed `next-auth` dependency references (was causing module resolution errors)
- ✅ Cleaned up unused middleware infrastructure
