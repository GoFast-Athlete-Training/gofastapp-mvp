# Create Crew Signup Flow

**Date:** January 2025  
**Status:** ✅ Complete  
**Route:** `/public/create-crew/signup`

---

## Overview

Created a dedicated signup flow for users who want to create a RunCrew from the public discovery page. This matches the join crew signup flow pattern.

---

## Flow Diagram

```
User on public discovery page
    ↓
Clicks "Start Your Crew"
    ↓
Redirects to /runcrew/create
    ↓
Not authenticated → Redirects to /public/create-crew/signup
    ↓
Signup Explainer Page
    - Explainer text
    - Google provider button
    - Email signup option
    ↓
User signs up (Google or Email)
    ↓
Check if profile exists
    ↓
┌─────────────────┬─────────────────┐
│ Profile Exists  │ No Profile      │
└─────────────────┴─────────────────┘
         ↓                    ↓
  /runcrew/create    /athlete-create-profile
                              ↓
                      After profile creation
                              ↓
                      /runcrew/create
```

---

## Files Created/Modified

### 1. **New File: `/app/public/create-crew/signup/page.tsx`**

**Purpose:** Signup explainer page for creating a crew

**Features:**
- Explainer text about why signup is required
- Google signup button
- Email signup form (toggle)
- Stores `runCrewCreateIntent` in localStorage
- After signup:
  - If profile exists → redirects to `/runcrew/create`
  - If no profile → redirects to `/athlete-create-profile` (which will redirect to create after)

**Key Code:**
```typescript
// Store create intent
localStorage.setItem('runCrewCreateIntent', 'true');

// After signup, check profile
if (athleteData?.gofastHandle) {
  // Profile complete - go to create crew
  router.push('/runcrew/create');
} else {
  // No profile - go to profile creation
  router.push('/athlete-create-profile');
}
```

---

### 2. **Modified: `/app/runcrew/create/page.tsx`**

**Changes:**
- Removed inline signup prompt
- Added redirect to `/public/create-crew/signup` for unauthenticated users
- Shows loading state while redirecting

**Before:** Showed signup prompt inline  
**After:** Redirects to dedicated signup page

---

### 3. **Modified: `/app/athlete-create-profile/page.tsx`**

**Changes:**
- Added check for `runCrewCreateIntent` in localStorage
- If create intent exists → redirects to `/runcrew/create` after profile creation
- Priority: Create intent > Join intent > Normal flow

**Key Code:**
```typescript
// Check for create crew intent first
const createCrewIntent = localStorage.getItem('runCrewCreateIntent');
if (createCrewIntent) {
  localStorage.removeItem('runCrewCreateIntent');
  router.push('/runcrew/create');
} else {
  // Check for join intent...
}
```

---

## User Flow Details

### Unauthenticated User Flow

1. **Public Discovery Page** (`/runcrew-discovery-public`)
   - User clicks "Start Your Crew"
   - Redirects to `/runcrew/create`

2. **Create Crew Page** (`/runcrew/create`)
   - Detects user is not authenticated
   - Redirects to `/public/create-crew/signup`

3. **Signup Explainer** (`/public/create-crew/signup`)
   - Shows explainer: "To protect our community..."
   - Google signup button
   - Email signup option
   - Stores `runCrewCreateIntent` in localStorage

4. **After Signup:**
   - **If profile exists:**
     - Stores athlete data
     - Redirects to `/runcrew/create`
   - **If no profile:**
     - Redirects to `/athlete-create-profile`
     - After profile creation → redirects to `/runcrew/create`

### Authenticated User Flow

1. **Public Discovery Page** (`/runcrew-discovery-public`)
   - User clicks "Start Your Crew"
   - Redirects to `/runcrew/create`

2. **Create Crew Page** (`/runcrew/create`)
   - User is authenticated
   - Shows full create crew form immediately

---

## localStorage Keys

### `runCrewCreateIntent`
- **Value:** `'true'` (string)
- **Set:** When user clicks signup on explainer page
- **Cleared:** After redirecting to create crew page
- **Purpose:** Track user intent to create crew through profile creation

---

## Comparison with Join Crew Flow

| Aspect | Join Crew | Create Crew |
|--------|-----------|-------------|
| **Signup Route** | `/join/runcrew/[handle]/signup` | `/public/create-crew/signup` |
| **Intent Key** | `runCrewJoinIntent` + `runCrewJoinIntentHandle` | `runCrewCreateIntent` |
| **After Profile** | `/join/runcrew/[handle]/confirm` | `/runcrew/create` |
| **After Signup (profile exists)** | `/join/runcrew/[handle]/confirm` | `/runcrew/create` |

Both flows follow the same pattern:
1. Explainer page
2. Signup (Google/Email)
3. Check profile
4. Redirect based on profile state

---

## Testing

### Test Unauthenticated Flow
1. Open incognito/private window
2. Visit `/runcrew-discovery-public`
3. Click "Start Your Crew"
4. Should redirect to `/public/create-crew/signup`
5. Click "Sign up with Google"
6. Complete signup
7. If profile exists → should go to `/runcrew/create`
8. If no profile → should go to `/athlete-create-profile` → then `/runcrew/create`

### Test Authenticated Flow
1. Sign in to account
2. Visit `/runcrew-discovery-public`
3. Click "Start Your Crew"
4. Should go directly to `/runcrew/create` with full form

---

## Summary

✅ **Dedicated signup page** for create crew flow  
✅ **Matches join crew pattern** for consistency  
✅ **Proper intent tracking** via localStorage  
✅ **Profile creation integration** redirects to create crew  
✅ **Smooth UX** - no dead ends, clear path forward

