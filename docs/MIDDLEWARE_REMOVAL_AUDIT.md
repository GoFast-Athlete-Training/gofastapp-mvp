# Middleware Removal Audit

**Date:** February 1, 2026  
**Status:** ✅ Removed middleware and onboarding-intent library (deprecated for MVP1)

---

## Purpose of Removed Code

The middleware/onboarding-intent system was designed to:
- **Detect club leaders** visiting `leader.*` subdomain
- **Grant access to content pages** for editing their run club's public content
- **Provide different front door** (`/leader` hub) vs regular athletes (`/home`)

---

## Files Removed

1. **`middleware.ts`** - Next.js middleware that set onboarding intent cookie based on hostname (`leader.*` → CLUB_LEADER)
2. **`lib/onboarding-intent.ts`** - Helper library that read onboarding intent cookie (used `next/headers` which caused build errors)

---

## Files Updated

1. **`app/page.tsx`** - Removed `getOnboardingIntentClient()` usage, defaults to `/home`
2. **`app/signup/page.tsx`** - Removed `getOnboardingIntentClient()` usage, removed all `onboardingIntent` state
3. **`app/api/athlete/create/route.ts`** - Removed `onboardingIntent` handling (was only logging, never assigned roles)

---

## Impact Analysis

### What Was Removed:
- Hostname-based onboarding intent detection (`leader.*` subdomain → CLUB_LEADER)
- Cookie-based intent storage (`onboarding_intent` cookie)
- Client-side intent reading functions
- Request body intent handling in API

### What Still Works:
- ✅ Authentication flow - Unaffected
- ✅ Signup flow - Works without intent detection
- ✅ `/app/leader/page.tsx` - Leader hub page still exists (placeholder)
- ✅ Content editing - GoFastCompany dashboard still has run club editing

### What's Missing (for MVP2):
- ❌ Role assignment logic (CLUB_LEADER role)
- ❌ Automatic routing to `/leader` hub
- ❌ Subdomain-based detection
- ❌ Content page access control

---

## Migration Notes

- All onboarding intent code removed (deprecated for MVP1)
- **Will return in MVP2** with proper implementation (see `CLUB_LEADER_ONBOARDING_INTENT.md`)
- No automatic hostname detection
- No cookie-based intent storage
- No request body intent handling

**See:** `docs/CLUB_LEADER_ONBOARDING_INTENT.md` for MVP2 implementation plan

---

## Build Errors Fixed

- ✅ Removed `next/headers` dependency that caused "You're importing a component that needs 'next/headers'" error
- ✅ Removed `next-auth` dependency references (was causing module resolution errors)
- ✅ Cleaned up unused middleware infrastructure
