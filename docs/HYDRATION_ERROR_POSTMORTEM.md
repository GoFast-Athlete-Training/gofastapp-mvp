# Hydration Error #310 Postmortem

**Date:** January 2026  
**Affected Route:** `/runcrew/create`  
**Error:** `Uncaught Error: Minified React error #310` (Hydration mismatch)  
**Resolution Time:** ~45 minutes  
**Root Causes Found:** 3 distinct issues

---

## 🚨 The Symptom

The create crew page showed:
```
Application error: a client-side exception has occurred while loading
runcrew.gofastcrushgoals.com (see the browser console for more information).
```

Console error:
```
Uncaught Error: Minified React error #310
```

React error #310 = **Hydration mismatch** - the server-rendered HTML doesn't match what the client tries to render.

---

## 🔍 Investigation Timeline

### Phase 1: Initial Diagnosis (Wrong)

**Observation:** The page had both `'use client'` and `export const dynamic = 'force-dynamic'`

**Initial Fix:** Remove `export const dynamic = 'force-dynamic'` from client components

**Result:** ❌ Error persisted

**Why it was wrong:** This was A problem, but not THE problem causing the immediate crash.

### Phase 2: Architectural Fix (Correct but Incomplete)

**Observation:** `export const dynamic` belongs in server files, not client components

**Fix:** Created `layout.tsx` files with `force-dynamic`, removed from `page.tsx` files

**Result:** ❌ Error still persisted

**Why it didn't fix it:** The architecture was now correct, but there was a deeper bug in the component itself.

### Phase 3: Root Cause Found (The Real Bug)

**Observation:** `useEffect` hook was placed AFTER a conditional return statement

```tsx
// ❌ BROKEN CODE
if (checkingAuth) {
  return <Loading />;  // Early return
}

useEffect(() => { ... });  // Hook AFTER return = RULES OF HOOKS VIOLATION
```

**Fix:** Move `useEffect` BEFORE all conditional returns

**Result:** ✅ Page works!

---

## 🐛 All Issues Found

### Issue 1: Rules of Hooks Violation (Primary Cause)

**Location:** `app/runcrew/create/page.tsx` lines 516-535

**The Bug:**
```tsx
// Show loading state while checking auth
if (checkingAuth) {
  return (
    <div>Loading...</div>
  );
}

// ❌ useEffect AFTER conditional return
useEffect(() => {
  if (!checkingAuth && isAuthenticated === false) {
    router.replace('/public/create-crew/signup');
  }
}, [checkingAuth, isAuthenticated, router]);
```

**Why It Breaks:**
1. First render: `checkingAuth=true` → early return → useEffect NOT called (0 hooks after return)
2. Second render: `checkingAuth=false` → no early return → useEffect IS called (1 hook after return)
3. React sees different number of hooks between renders → **Hydration error**

**The Fix:**
```tsx
// ✅ useEffect BEFORE any conditional returns
useEffect(() => {
  if (!checkingAuth && isAuthenticated === false) {
    router.replace('/public/create-crew/signup');
  }
}, [checkingAuth, isAuthenticated, router]);

// Conditional returns AFTER all hooks
if (checkingAuth) {
  return <Loading />;
}
```

### Issue 2: Mixed Server/Client Directives

**Location:** 27 page.tsx files across the codebase

**The Bug:**
```tsx
'use client';  // Makes it a CLIENT component

export const dynamic = 'force-dynamic';  // SERVER-ONLY directive
```

**Why It's Wrong:**
- `export const dynamic` is a Next.js route segment config
- It only works in SERVER components (no `'use client'`)
- Putting it in a client component creates undefined behavior

**The Fix:**
- Remove `export const dynamic` from all client components
- If dynamic rendering is needed, put it in a sibling `layout.tsx` (which is a server component)

```
app/runcrew/create/
├── layout.tsx    → export const dynamic = 'force-dynamic' (SERVER)
└── page.tsx      → 'use client' (CLIENT)
```

### Issue 3: Public/Private Route Collision

**Location:** `app/runcrew-discovery-public/page.tsx`

**The Bug:**
- Public discovery page (for unauthenticated users) had "Create Crew" button
- Button linked to `/runcrew/create` (authenticated-only page)
- Unauthenticated users hitting authenticated page caused redirect loops

**The Fix:**
- Changed links on public pages from `/runcrew/create` to `/public/create-crew/signup`
- Public users now go through proper signup flow first

---

## 📚 Lessons Learned

### 1. Rules of Hooks Are Absolute

**Rule:** Hooks must be called:
- At the top level of the component
- In the same order on every render
- BEFORE any conditional returns

**Bad Pattern:**
```tsx
if (someCondition) {
  return <Early />;
}
useEffect(() => {}); // ❌ After return
```

**Good Pattern:**
```tsx
useEffect(() => {}); // ✅ Before any returns

if (someCondition) {
  return <Early />;
}
```

### 2. Server vs Client Component Boundaries

**Next.js 13+ Rule:**
- Route segment configs (`dynamic`, `revalidate`, `runtime`) belong in SERVER files only
- Server files: `layout.tsx`, `page.tsx` (without 'use client'), `route.ts`
- Client files: Any file with `'use client'`

**Pattern for Dynamic Client Pages:**
```
app/some-route/
├── layout.tsx    → Server config here (dynamic, revalidate, etc.)
└── page.tsx      → 'use client' + component logic here
```

### 3. Public vs Authenticated Routes

**Rule:** Public pages should never link directly to authenticated pages.

**Flow:**
```
Public User → Public Page → Public Signup → Auth → Authenticated Page
                  ↓
           NOT directly to authenticated page
```

### 4. Hydration Errors Are Often Deeper Than They Appear

**Initial assumption:** "It's a simple config conflict"  
**Reality:** There were 3 layered issues

**Debugging approach:**
1. Fix the obvious issue
2. If error persists, look deeper
3. Check for hooks violations (they don't always show as ESLint errors)
4. Check conditional rendering logic
5. Check all imports for hydration-unsafe patterns

---

## 🛠️ Prevention Checklist

### Before Committing Client Components:

- [ ] All `useEffect`, `useState`, `useCallback`, etc. are BEFORE any `return` statements
- [ ] No `export const dynamic/revalidate/runtime` in files with `'use client'`
- [ ] No conditional hooks (`if (x) { useEffect(...) }`)
- [ ] No hooks inside loops or nested functions

### Before Committing Route Changes:

- [ ] Public pages link to public routes
- [ ] Authenticated pages are not directly accessible from public pages
- [ ] Route configs are in layout.tsx, not page.tsx (for client pages)

### ESLint Rules to Enable:

```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

---

## 📁 Files Changed

| File | Change |
|------|--------|
| `app/runcrew/create/page.tsx` | Moved useEffect before conditional returns |
| `app/runcrew/create/layout.tsx` | Created with `force-dynamic` |
| `app/runcrew-discovery-public/page.tsx` | Fixed links to use public signup route |
| `app/start-crew/page.tsx` | Fixed links to use public signup route |
| 27 other page.tsx files | Removed `export const dynamic` |
| 8 new layout.tsx files | Created with `force-dynamic` for routes that need it |

---

## 🔗 References

- [React Error #310](https://react.dev/errors/310) - Hydration mismatch
- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [Next.js Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [Next.js Server vs Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)

