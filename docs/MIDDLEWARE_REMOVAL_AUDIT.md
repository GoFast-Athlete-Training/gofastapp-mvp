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
- Authentication flow - Unaffected
- Signup flow - Works without intent detection

### Migration Notes:
- All onboarding intent code removed (deprecated for MVP1)
- May return in MVP2 with better auth handling
- No automatic hostname detection
- No cookie-based intent storage
- No request body intent handling

---

## Build Errors Fixed

- ✅ Removed `next/headers` dependency that caused "You're importing a component that needs 'next/headers'" error
- ✅ Removed `next-auth` dependency references (was causing module resolution errors)
- ✅ Cleaned up unused middleware infrastructure
