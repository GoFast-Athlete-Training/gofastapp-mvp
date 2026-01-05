# Welcome Page Redirect Audit

## Purpose
Document all redirects to `/welcome` and determine if they should redirect to RunCrew landing pages instead.

## Current `/welcome` Page Purpose
The `/welcome` page is the **RunCrew Selector** - it:
- Hydrates athlete data
- Shows all RunCrews the user is a member of
- Provides navigation to individual RunCrew pages

## Redirects to `/welcome` Found

### Settings Page (`/runcrew/[runCrewId]/settings`)
1. **After Archive** (line 765) - ✅ **Correct** - User should see RunCrew selector after archiving
2. **Error states** (lines 346, 363) - ✅ **Correct** - Generic error fallback to selector
3. **Delete Success** (lines 955, 961) - ✅ **Correct** - Both "Create Another" and "Join a RunCrew" go to selector

### RunCrew Home Page (`/runcrew/[runCrewId]`)
1. **"Back to RunCrews" links** (lines 156, 173, 190, 243) - ✅ **Correct** - Returns to selector

### Admin Page (`/runcrew/[runCrewId]/admin`)
1. **"Back to RunCrews" links** (lines 469, 495, 513, 561) - ✅ **Correct** - Returns to selector
2. **Error state** (line 469) - ✅ **Correct** - RunCrew not found, return to selector

### Member Page (`/runcrew/[runCrewId]/member`)
1. **"Back to RunCrews" link** (line 309) - ✅ **Correct** - Returns to selector

### Other Pages
1. **Signup page** - ✅ **Correct** - After signup, redirect to selector to see RunCrews
2. **Root page** - ✅ **Correct** - Redirects to selector if authenticated

## Analysis

**All redirects to `/welcome` are appropriate** because:
- `/welcome` is the RunCrew selector/landing page
- It's the central hub for navigating between RunCrews
- After actions like delete/archive, users should return to the selector
- The RunCrew landing page (`/runcrew/[runCrewId]`) is for a **specific** crew, not the general selector

## Recommendation

**No changes needed.** The redirects are correct:
- `/welcome` = General RunCrew selector (all crews)
- `/runcrew/[runCrewId]` = Specific RunCrew landing page

The distinction is clear and appropriate.

