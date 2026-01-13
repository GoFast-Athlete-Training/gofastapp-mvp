# Navigation Architecture Analysis

**Date:** January 2025  
**Status:** ✅ Implemented  
**Purpose:** Define clear navigation patterns for RunCrew selection and discovery

**Related:** See [Welcome vs My-RunCrews Pattern](./WELCOME_VS_MYRUNCREWS_PATTERN.md) for detailed explanation of the dual-purpose pattern.

---

## Core Navigation Principles

### 1. **Front Door Handler** (`/welcome`)
- **Purpose:** Front door entry point that handles hydration + shows selector UI
- **Role:** Front door handler (not home handler)
- **Message:** "Welcome back" (greeting during hydration)
- **Behavior:**
  - Waits for Firebase auth
  - Shows "Welcome back" message
  - Calls `/api/athlete/hydrate` once (API call)
  - Stores athlete data in localStorage
  - **Shows the same RunCrew selector UI as `/my-runcrews`** (does NOT redirect)
  - User interacts directly on welcome page (no redirect = no "yank")
- **When to use:** Only from signup/root page after authentication
- **Never use as:** A navigation target or "home" page (for back buttons, etc.)
- **See:** [Welcome vs My-RunCrews Pattern](./WELCOME_VS_MYRUNCREWS_PATTERN.md)

### 2. **Home Handler** (`/my-runcrews`)
- **Purpose:** Home base where users return to select/manage their RunCrews
- **Role:** Home handler (navigation target)
- **Message:** "Hey [FirstName] — which RunCrew do you want to check on?" (action-oriented)
- **Behavior:**
  - Reads from localStorage (no API calls - already hydrated)
  - Shows the same RunCrew selector UI as `/welcome` (consistent experience)
  - Displays all RunCrews user is a member of
  - Provides "View as Member" and "View as Admin" buttons
  - Shows "Explore RunCrews" and "Create RunCrew" buttons
- **When to redirect here:**
  - ✅ Coming back from profile page
  - ✅ Coming back from admin functions (settings, admin page)
  - ✅ Navigation from member pages
  - ✅ User is "lost" and needs a safe landing zone
  - ✅ After completing actions (archive, delete, etc.) **IF** user still has other crews
  - ✅ TopNav logo click
- **Fallback:** If no crews exist, redirects to `/runcrew` (discovery)
- **See:** [Welcome vs My-RunCrews Pattern](./WELCOME_VS_MYRUNCREWS_PATTERN.md)

### 3. **RunCrew Discovery** (`/runcrew`)
- **Purpose:** Discover and join new RunCrews
- **Behavior:**
  - Shows discoverable/public RunCrews
  - Filter/search capabilities
  - "Start Your Crew" button
- **When to redirect here:**
  - ✅ After profile creation (new user, no crews yet)
  - ✅ After deleting/archiving last crew (no crews remain)
  - ✅ User explicitly wants to discover/join crews
  - ✅ User has no RunCrews (fallback from `/my-runcrews`)

---

## Navigation Rules

### Rule 1: Profile Page Navigation
```
Profile Page → Back Button → /my-runcrews
```
**Rationale:** User viewing their own profile should return to their RunCrew selector

### Rule 2: Admin/Management Pages
```
Admin Page → Back Button → /my-runcrews
Settings Page → Back Button → /my-runcrews
Member Page → Back Button → /my-runcrews
```
**Rationale:** These are management functions, user should return to selector

### Rule 3: After Actions (Archive/Delete)
```
IF user still has other RunCrews:
  → /my-runcrews
ELSE (no crews remaining):
  → /runcrew (discovery)
```
**Rationale:** If user has crews, show selector. If none remain, show discovery.

### Rule 4: After Profile Creation
```
Profile Created → /runcrew (discovery)
```
**Rationale:** New user needs to discover/join their first crew

### Rule 5: TopNav Logo
```
Logo Click → /my-runcrews
```
**Rationale:** Logo should return user to their personal sandbox

### Rule 6: Signup/Login Flow
```
Authenticated → /welcome (hydrate) → /my-runcrews
```
**Rationale:** Hydrate once, then show selector

### Rule 7: No Crews Fallback
```
/my-runcrews (no crews) → Auto-redirect to /runcrew
```
**Rationale:** If selector is empty, automatically show discovery

---

## Redirect Decision Tree

```
User Action
│
├─ Profile View → /my-runcrews
│
├─ Admin Function (settings, admin page) → /my-runcrews
│
├─ Archive/Delete Crew
│   ├─ Has other crews? → /my-runcrews
│   └─ Last crew? → /runcrew (discovery)
│
├─ Profile Creation (new user) → /runcrew (discovery)
│
├─ Authenticated (signup/login) → /welcome → /my-runcrews
│
└─ Lost/Need Navigation → /my-runcrews
```

---

## Page Responsibilities

| Page | Hydration | Data Source | Primary Purpose | Redirects To |
|------|-----------|-------------|-----------------|--------------|
| `/welcome` | ✅ Yes (once) | API call | Front door handler (hydrate + show selector) | N/A (shows UI directly) |
| `/my-runcrews` | ❌ No | localStorage | Home handler (selector) | `/runcrew` if no crews |
| `/runcrew` | ❌ No | API call | Discovery/exploration | N/A |
| `/profile` | ❌ No | localStorage | View/edit profile | Back to `/my-runcrews` |
| `/runcrew/[id]/admin` | ❌ No | API call | Admin functions | Back to `/my-runcrews` |
| `/runcrew/[id]/member` | ❌ No | API call | Member view | Back to `/my-runcrews` |
| `/runcrew/[id]/settings` | ❌ No | API call | Crew settings | Back to `/my-runcrews` |

---

## Implementation Checklist

### ✅ Welcome Page (`/welcome`)
- [x] Hydrates athlete data
- [x] Stores in localStorage
- [x] Redirects to `/my-runcrews`
- [x] Shows loading state during redirect

### ✅ My RunCrews Page (`/my-runcrews`)
- [x] Reads from localStorage only
- [x] Displays "Hey runner — which RunCrew do you want to check on?"
- [x] Shows RunCrew cards with Member/Admin buttons
- [x] Redirects to `/runcrew` if no crews exist
- [x] Links to discovery page if empty

### ✅ Navigation Updates
- [x] Profile page back button → `/my-runcrews`
- [x] TopNav logo → `/my-runcrews`
- [x] Admin page back buttons → `/my-runcrews`
- [x] Member page back buttons → `/my-runcrews`
- [x] Settings page back buttons → `/my-runcrews`
- [x] Settings-minimal → `/my-runcrews`

### ✅ Conditional Redirects
- [x] After archive: Check crews count → `/my-runcrews` or `/runcrew`
- [x] After delete: Check crews count → `/my-runcrews` or `/runcrew`
- [x] After profile creation: Always → `/runcrew`

---

## Edge Cases

### Case 1: User deletes last RunCrew
**Flow:** Settings → Delete → Check crew count → `/runcrew` (discovery)

### Case 2: User archives last RunCrew
**Flow:** Settings → Archive → Check crew count → `/my-runcrews` (still has archived crew)

### Case 3: User navigates to `/my-runcrews` with no crews
**Flow:** `/my-runcrews` → Check localStorage → Auto-redirect to `/runcrew`

### Case 4: User navigates to `/my-runcrews` with no localStorage
**Flow:** `/my-runcrews` → No data → Redirect to `/welcome` (hydrate) → `/my-runcrews`

### Case 5: Direct navigation to `/welcome` when already hydrated
**Flow:** `/welcome` → Check localStorage → If hydrated, redirect to `/my-runcrews`

---

## Testing Scenarios

1. **New User Flow:**
   - Signup → `/welcome` (hydrate) → `/my-runcrews` → No crews → `/runcrew`

2. **Existing User Flow:**
   - Login → `/welcome` (hydrate) → `/my-runcrews` → Select crew

3. **Profile Navigation:**
   - `/my-runcrews` → Profile → Back → `/my-runcrews`

4. **Admin Navigation:**
   - `/my-runcrews` → Admin → Back → `/my-runcrews`

5. **Last Crew Deletion:**
   - Settings → Delete → No crews → `/runcrew`

---

## Migration Notes

**Old Pattern:**
- All navigation went to `/welcome`
- `/welcome` served as both hydration AND selector

**New Pattern:**
- `/welcome` = Hydration only (transparent redirect)
- `/my-runcrews` = Selector (user-facing)
- `/runcrew` = Discovery (when no crews)

**Breaking Changes:**
- TopNav logo now points to `/my-runcrews` instead of `/welcome`
- All "back" buttons now point to `/my-runcrews` instead of `/welcome`
- After profile creation, redirect to `/runcrew` instead of `/welcome`

