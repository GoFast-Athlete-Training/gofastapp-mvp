# Firebase Auth Persistence Fix

**Date**: January 2025  
**Issue**: Users were being logged out on page refresh  
**Root Cause**: Missing Firebase auth persistence and improper auth state checking

---

## Problem

Users were being forced to sign in again after refreshing the page, even though they were still authenticated.

## Root Causes Identified

### 1. Missing Auth Persistence
Firebase was not configured to persist authentication state across page refreshes.

### 2. Improper Auth State Checking
The code was checking `auth.currentUser` immediately on component mount, but Firebase auth takes time to initialize after a page refresh. This caused the check to return `null` even when the user was actually authenticated.

---

## Solution

### 1. Added Firebase Auth Persistence

**File**: `lib/firebase.ts`

Added `setPersistence` to keep users logged in across page refreshes:

```typescript
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

export const auth = getAuth(app);

// Set persistence to keep user logged in across page refreshes
// This is critical for preventing logout on refresh
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Failed to set auth persistence:", error);
  });
}
```

**What this does:**
- Stores the auth token in browser localStorage
- Keeps the user logged in across page refreshes
- Persists across browser sessions until explicit sign out

---

### 2. Fixed Auth State Initialization

**File**: `app/athlete-welcome/page.tsx`

**Before (❌ WRONG):**
```typescript
const user = auth.currentUser; // Will be null on page refresh!
if (!user) {
  router.replace('/signup');
  return;
}
```

**After (✅ CORRECT):**
```typescript
// CRITICAL: Wait for Firebase auth to initialize using onAuthStateChanged
// DO NOT check auth.currentUser directly - it will be null on page refresh!
const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
  setAuthInitialized(true);

  if (!firebaseUser) {
    router.replace('/signup');
    setIsLoading(false);
    return;
  }

  // Now we have a Firebase user - proceed with hydration
  await hydrateAthlete(firebaseUser);
});
```

**What this does:**
- Waits for Firebase to initialize auth state
- Only checks auth state AFTER Firebase is ready
- Prevents false negatives on page refresh

---

## Key Patterns

### ✅ ALWAYS Use `onAuthStateChanged`

Firebase auth takes time to initialize. Always use the listener pattern:

```typescript
import { onAuthStateChanged } from 'firebase/auth';

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      // User is authenticated
    } else {
      // User is not authenticated
    }
  });

  return () => unsubscribe();
}, []);
```

### ❌ NEVER Check `auth.currentUser` Immediately

```typescript
// ❌ WRONG - Will be null on page refresh!
const user = auth.currentUser;
if (!user) {
  // This will trigger even if user is logged in!
}
```

---

## Files Changed

1. **`lib/firebase.ts`**
   - Added `setPersistence(auth, browserLocalPersistence)`
   - Ensures auth state persists across refreshes

2. **`app/athlete-welcome/page.tsx`**
   - Replaced immediate `auth.currentUser` check with `onAuthStateChanged`
   - Added `authInitialized` state to track initialization
   - Added loading state while waiting for auth to initialize

---

## Testing

To verify the fix works:

1. **Sign in** to the app
2. **Refresh the page** (F5 or Cmd+R)
3. **Verify**: User should remain logged in, no redirect to signup

**Before fix**: User redirected to signup on refresh  
**After fix**: User stays logged in across refreshes

---

## Additional Notes

### Why `browserLocalPersistence`?

- **`browserLocalPersistence`**: Persists across browser sessions (recommended)
- **`browserSessionPersistence`**: Only persists for current session
- **`inMemoryPersistence`**: No persistence (logs out on refresh)

We use `browserLocalPersistence` to match the expected behavior where users stay logged in until they explicitly sign out.

### Token Refresh

Firebase automatically refreshes tokens every hour. The `onAuthStateChanged` listener will fire when the token is refreshed, allowing you to update your session if needed.

### Related Files

- `app/athlete-home/page.tsx` - Uses hooks that read from localStorage, should work correctly
- `lib/api.ts` - Has interceptor that automatically adds tokens to requests
- Auth state is checked properly in hooks, which read from localStorage after hydration

---

## Migration Notes

If other pages have similar issues, update them to use `onAuthStateChanged`:

1. Import `onAuthStateChanged` from `firebase/auth`
2. Replace immediate `auth.currentUser` checks with the listener pattern
3. Add loading state while waiting for auth initialization
4. Clean up the listener on unmount

---

**Status**: ✅ Fixed and deployed  
**Impact**: Users now stay logged in across page refreshes

