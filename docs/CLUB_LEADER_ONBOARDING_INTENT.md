# Club Leader Onboarding Intent - MVP2 Feature

**Date:** February 1, 2026  
**Status:** ⚠️ Deprecated for MVP1, Planned for MVP2

---

## Purpose

The onboarding intent system was designed to give **club leaders** a different front door URL and access to content pages for managing their run club's public-facing content.

---

## How It Was Supposed to Work

### Flow:
1. **Club leader visits `leader.*` subdomain** (e.g., `leader.gofastcrushgoals.com`)
2. **Middleware detects hostname** → Sets `onboarding_intent` cookie = `CLUB_LEADER`
3. **Signup/Login** → Reads cookie, passes `onboardingIntent: 'CLUB_LEADER'` to API
4. **API assigns CLUB_LEADER role** → Grants access to content management
5. **Routes to `/leader` hub** → Different front door than regular athletes (`/home`)

### Content Page Access:
- Club leaders can **edit their run club's content pages** (in `gofast-contentpublic`)
- Access to `/dashboard/entities/manage/runclubs/[id]/edit` (GoFastCompany)
- Different entry point than regular athletes

---

## Why It Was Removed

1. **Build Errors:** `lib/onboarding-intent.ts` used `next/headers` (server-only) in client components
2. **Incomplete Implementation:** Role assignment was never implemented (just logging)
3. **Cookie Issues:** Cookie-based detection was causing build failures
4. **MVP1 Focus:** Not critical for MVP1, can be properly implemented in MVP2

---

## MVP2 Implementation Plan

### Option 1: Proper Cookie-Based (Server Components)
- Use Next.js middleware properly (server-side only)
- Set cookie in middleware (server)
- Read cookie in API routes (server)
- No client-side cookie reading

### Option 2: Query Parameter Based
- Club leaders visit `?intent=club-leader` or `?role=club-leader`
- Pass through signup flow
- API assigns role based on query param
- No cookies needed

### Option 3: Subdomain + API Detection
- Detect `leader.*` subdomain in API route
- Check if user is associated with a run club
- Auto-assign CLUB_LEADER role
- Route to `/leader` hub

### Option 4: Explicit Role Assignment
- Admin assigns CLUB_LEADER role in GoFastCompany dashboard
- No automatic detection
- User logs in → sees `/leader` hub if they have role

---

## Current State

### What Exists:
- ✅ `/app/leader/page.tsx` - Leader hub placeholder page
- ✅ `/dashboard/entities/manage/runclubs/[id]/edit` - Content editing (GoFastCompany)
- ✅ Run club content pages in `gofast-contentpublic`

### What's Missing:
- ❌ Role assignment logic
- ❌ Subdomain detection
- ❌ Cookie-based intent (removed)
- ❌ Automatic routing to `/leader` hub

---

## Recommendation for MVP2

**Use Option 4 (Explicit Role Assignment):**
- Most reliable and secure
- No cookie/subdomain complexity
- Clear admin control
- Easy to implement

**Flow:**
1. Admin assigns CLUB_LEADER role in GoFastCompany dashboard
2. User logs in → API checks role
3. If CLUB_LEADER → route to `/leader` hub
4. Leader hub shows links to edit their club's content pages

---

## Related Files

- `app/leader/page.tsx` - Leader hub (placeholder)
- `app/api/athlete/create/route.ts` - Was supposed to assign role (removed)
- `gofast-contentpublic/app/runclub/[slug]/page.tsx` - Public content pages
- `GoFastCompany/app/dashboard/entities/manage/runclubs/[id]/edit/page.tsx` - Content editing
