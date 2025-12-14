# Identity & Authorization Audit Report
**Date:** 2024-12-19  
**Scope:** gofastapp-mvp authentication, identity resolution, and authorization patterns

---

## Executive Summary

This audit examines the identity management system, authentication flows, and authorization checks across the GoFast MVP application. The system uses Firebase Authentication for user identity and Prisma/PostgreSQL for application data storage.

### Key Findings

✅ **Strengths:**
- Consistent Firebase token verification pattern
- Proper Bearer token extraction
- Good error handling in most routes

⚠️ **Issues Found:**
- **CRITICAL:** Missing authorization checks in several GET endpoints
- **HIGH:** Inconsistent identity resolution patterns
- **MEDIUM:** Potential race conditions in athlete creation
- **MEDIUM:** Email-based fallback creates security risk
- **LOW:** Inconsistent error messages

---

## 1. Authentication Architecture

### 1.1 Client-Side Authentication
**Location:** `lib/auth.ts`, `lib/firebase.ts`

- Uses Firebase Auth SDK
- Supports Google OAuth and email/password
- Token retrieval via `getToken()` function
- Persistence configured for browser sessions

**Status:** ✅ Secure

### 1.2 Server-Side Token Verification
**Location:** `lib/firebaseAdmin.ts`

```typescript
// Pattern used across all routes:
const authHeader = request.headers.get('authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const token = authHeader.substring(7);
const decodedToken = await adminAuth.verifyIdToken(token);
const firebaseId = decodedToken.uid;
```

**Status:** ✅ Consistent and secure

---

## 2. Identity Resolution Patterns

### 2.1 Firebase UID → Athlete Resolution

The application uses `firebaseId` (unique) as the primary link between Firebase users and Athlete records.

**Primary Resolution Function:**
```typescript
// lib/domain-athlete.ts
export async function getAthleteByFirebaseId(firebaseId: string) {
  return prisma.athlete.findUnique({
    where: { firebaseId },
  });
}
```

**Status:** ✅ Correct

### 2.2 Athlete Creation Flow
**Location:** `app/api/athlete/create/route.ts`

**Current Flow:**
1. Verify Firebase token → get `firebaseId`
2. Lookup athlete by `firebaseId`
3. **FALLBACK:** If not found, lookup by `email` (⚠️ **SECURITY RISK**)
4. If found by email, update `firebaseId` to match current Firebase user
5. If not found at all, create new athlete

**Issues Identified:**

#### ⚠️ **CRITICAL: Email-Based Fallback Creates Security Vulnerability**

```typescript:74-89:app/api/athlete/create/route.ts
// First check if athlete exists by firebaseId
let existing = await prisma.athlete.findUnique({
  where: { firebaseId },
});

// If not found by firebaseId, check by email (handles case where Firebase user was recreated)
if (!existing && email) {
  existing = await prisma.athlete.findFirst({
    where: { email },
  });
  
  if (existing) {
    console.log('⚠️ ATHLETE CREATE: Found athlete by email with different firebaseId. Updating firebaseId to match current Firebase user.');
  }
}
```

**Problem:**
- If a Firebase user is deleted and recreated with the same email, the system will automatically link the new Firebase UID to the existing athlete record
- This could allow account takeover if:
  - User A's Firebase account is deleted
  - User B creates a Firebase account with User A's email
  - User B gains access to User A's athlete data

**Recommendation:**
- Remove email-based fallback
- Require explicit account recovery flow
- Add audit logging for `firebaseId` changes

#### ⚠️ **MEDIUM: Race Condition in Athlete Creation**

The lookup-then-create pattern is not atomic. Two concurrent requests could both pass the `findUnique` check and attempt to create duplicate records.

**Recommendation:**
- Use Prisma's `upsert` with unique constraint handling
- Or wrap in database transaction

---

## 3. Authorization Checks Analysis

### 3.1 Routes with Proper Authorization

✅ **Routes that verify user owns the resource:**

1. **`PUT /api/athlete/[id]/route.ts`** (Line 82)
   ```typescript
   if (!athlete || athlete.firebaseId !== decodedToken.uid) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
   }
   ```

2. **`PUT /api/athlete/[id]/profile/route.ts`** (Line 46)
   ```typescript
   if (athlete.firebaseId !== firebaseId) {
     return NextResponse.json({ 
       success: false, 
       error: 'Forbidden',
       message: 'You can only update your own profile'
     }, { status: 403 });
   }
   ```

3. **`POST /api/runcrew/[id]/announcements/route.ts`** (Line 101)
   ```typescript
   if (crew.userRole !== 'admin' && crew.userRole !== 'manager') {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
   }
   ```

4. **`POST /api/runcrew/[id]/runs/route.ts`** (Line 101)
   ```typescript
   if (crew.userRole !== 'admin' && crew.userRole !== 'manager') {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
   }
   ```

### 3.2 Routes Missing Authorization Checks

❌ **CRITICAL: Routes that authenticate but don't verify resource ownership:**

1. **`GET /api/athlete/[id]/route.ts`**
   - ✅ Verifies Firebase token
   - ❌ **MISSING:** Does not verify `athlete.firebaseId === decodedToken.uid`
   - **Impact:** Any authenticated user can view any athlete's data
   - **Fix Required:** Add ownership check

2. **`GET /api/runcrew/[id]/route.ts`**
   - ✅ Verifies Firebase token
   - ❌ **MISSING:** Does not verify user is a member of the crew
   - **Impact:** Any authenticated user can view any crew's details
   - **Fix Required:** Verify membership via `hydrateCrew(id, athlete.id)` and check `userRole`

3. **`GET /api/runcrew/[id]/messages/route.ts`**
   - ✅ Verifies Firebase token
   - ❌ **MISSING:** Does not verify user is a member of the crew
   - **Impact:** Any authenticated user can read any crew's messages
   - **Fix Required:** Verify membership before returning messages

4. **`GET /api/runcrew/[id]/announcements/route.ts`**
   - ✅ Verifies Firebase token
   - ❌ **MISSING:** Does not verify user is a member of the crew
   - **Impact:** Any authenticated user can view any crew's announcements
   - **Fix Required:** Verify membership before returning announcements

5. **`GET /api/runcrew/[id]/runs/route.ts`**
   - ✅ Verifies Firebase token
   - ❌ **MISSING:** Does not verify user is a member of the crew
   - **Impact:** Any authenticated user can view any crew's runs
   - **Fix Required:** Verify membership before returning runs

### 3.3 Routes with Partial Authorization

⚠️ **Routes that check membership but don't verify ownership:**

1. **`POST /api/runcrew/[id]/messages/route.ts`**
   - ✅ Verifies athlete exists
   - ⚠️ **PARTIAL:** Calls `hydrateCrew(id)` without `athleteId`, so doesn't verify membership
   - **Impact:** Any authenticated user can post messages to any crew
   - **Fix Required:** Call `hydrateCrew(id, athlete.id)` and verify `userRole` is not null

---

## 4. Data Consistency Issues

### 4.1 Email Uniqueness

**Schema Analysis:**
```prisma
model Athlete {
  firebaseId String @unique  // ✅ Unique
  email      String?         // ❌ NOT unique
  ...
}
```

**Issue:** Email is not unique in the schema, but the code assumes it can be used for lookups.

**Current Code:**
```typescript:82-84:app/api/athlete/create/route.ts
existing = await prisma.athlete.findFirst({
  where: { email },
});
```

**Problem:** If multiple athletes have the same email (null or duplicate), `findFirst` returns arbitrary result.

**Recommendation:**
- If email uniqueness is required, add `@unique` constraint
- If not required, remove email-based fallback entirely

### 4.2 Company Assignment

**Location:** `app/api/athlete/create/route.ts` (Line 63)

```typescript
const company = await prisma.goFastCompany.findFirst();
```

**Issue:** Uses `findFirst()` without ordering, which returns arbitrary company if multiple exist.

**Recommendation:**
- Use explicit company selection logic
- Or add ordering: `findFirst({ orderBy: { createdAt: 'asc' } })`

---

## 5. Security Vulnerabilities Summary

### Critical (Fix Immediately)

1. **Missing Authorization Checks in GET Endpoints**
   - **Affected:** 5 routes
   - **Risk:** Data exposure to unauthorized users
   - **Priority:** P0

2. **Email-Based Identity Fallback**
   - **Affected:** `app/api/athlete/create/route.ts`
   - **Risk:** Account takeover via email reuse
   - **Priority:** P0

### High (Fix Soon)

3. **Race Condition in Athlete Creation**
   - **Affected:** `app/api/athlete/create/route.ts`
   - **Risk:** Duplicate athlete records
   - **Priority:** P1

4. **Inconsistent Membership Verification**
   - **Affected:** RunCrew message posting
   - **Risk:** Unauthorized message posting
   - **Priority:** P1

### Medium (Address in Next Sprint)

5. **Arbitrary Company Selection**
   - **Affected:** Athlete creation
   - **Risk:** Data inconsistency
   - **Priority:** P2

6. **Inconsistent Error Messages**
   - **Affected:** Multiple routes
   - **Risk:** Information leakage, poor UX
   - **Priority:** P2

---

## 6. Recommendations

### Immediate Actions (This Week)

1. **Add Authorization Checks to All GET Endpoints**
   ```typescript
   // Example fix for GET /api/athlete/[id]/route.ts
   if (athlete.firebaseId !== decodedToken.uid) {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
   }
   ```

2. **Remove Email-Based Fallback**
   ```typescript
   // Remove lines 79-89 from athlete/create/route.ts
   // If athlete not found by firebaseId, return 404 or create new
   ```

3. **Add Membership Verification to RunCrew Routes**
   ```typescript
   // Example fix for GET /api/runcrew/[id]/messages/route.ts
   const firebaseId = decodedToken.uid;
   const athlete = await getAthleteByFirebaseId(firebaseId);
   if (!athlete) {
     return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
   }
   const crew = await hydrateCrew(id, athlete.id);
   if (!crew || !crew.userRole) {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
   }
   ```

### Short-Term Improvements (Next Sprint)

4. **Implement Atomic Athlete Creation**
   ```typescript
   // Use upsert pattern
   const athlete = await prisma.athlete.upsert({
     where: { firebaseId },
     update: { /* sync Firebase data */ },
     create: { firebaseId, /* ... */ },
   });
   ```

5. **Add Audit Logging**
   - Log all `firebaseId` changes
   - Log authorization failures
   - Log identity resolution events

6. **Standardize Error Responses**
   - Create error response utility
   - Consistent error codes and messages
   - No information leakage in errors

### Long-Term Enhancements

7. **Create Authorization Middleware**
   ```typescript
   // lib/middleware/auth.ts
   export async function requireAuth(request: Request) {
     // Extract and verify token
     // Return { firebaseId, decodedToken }
   }
   
   export async function requireAthlete(firebaseId: string) {
     // Resolve athlete
     // Return athlete or throw
   }
   
   export function requireOwnership(athlete: Athlete, firebaseId: string) {
     // Verify ownership
     // Throw if not owner
   }
   ```

8. **Add Role-Based Access Control (RBAC)**
   - Centralize role checking logic
   - Support for future roles/permissions

9. **Implement Rate Limiting**
   - Prevent brute force on token verification
   - Limit athlete creation attempts

---

## 7. Testing Recommendations

### Unit Tests Needed

1. **Authorization Tests**
   - Test that GET endpoints reject unauthorized access
   - Test that users cannot access other users' data
   - Test that non-members cannot access crew data

2. **Identity Resolution Tests**
   - Test athlete creation with existing firebaseId
   - Test athlete creation with new firebaseId
   - Test that email fallback is removed (after fix)

3. **Race Condition Tests**
   - Test concurrent athlete creation requests
   - Verify no duplicate records created

### Integration Tests Needed

1. **End-to-End Auth Flow**
   - Sign up → Create athlete → Access protected resources
   - Verify token refresh works
   - Verify logout clears state

2. **RunCrew Authorization Flow**
   - Create crew → Join crew → Post message → Verify access
   - Test manager/admin permissions
   - Test non-member access rejection

---

## 8. Code Quality Observations

### Positive Patterns

✅ Consistent token extraction pattern  
✅ Good error logging with context  
✅ Proper HTTP status codes (401, 403, 404)  
✅ Type-safe Prisma queries  
✅ Domain layer separation (`lib/domain-athlete.ts`, `lib/domain-runcrew.ts`)

### Areas for Improvement

⚠️ Inconsistent authorization patterns  
⚠️ Duplicate code across routes (could use middleware)  
⚠️ Some routes don't handle Prisma errors consistently  
⚠️ Missing input validation in some routes

---

## 9. Compliance & Privacy Considerations

### GDPR/Privacy

- ✅ User can update their own profile
- ❌ **MISSING:** User deletion endpoint (right to be forgotten)
- ❌ **MISSING:** Data export endpoint (data portability)
- ⚠️ Email fallback could expose data to wrong user

### Security Best Practices

- ✅ Uses HTTPS (assumed, via Next.js)
- ✅ Tokens not logged (except first 20 chars for debugging)
- ⚠️ No token refresh mechanism visible
- ⚠️ No session timeout/expiry handling

---

## 10. Conclusion

The authentication system is **functionally correct** but has **critical authorization gaps** that need immediate attention. The identity resolution pattern is sound but includes a risky email-based fallback that should be removed.

### Priority Fix Order:

1. **P0:** Add authorization checks to GET endpoints (5 routes)
2. **P0:** Remove email-based identity fallback
3. **P1:** Fix race condition in athlete creation
4. **P1:** Add membership verification to RunCrew routes
5. **P2:** Standardize error handling and add audit logging

### Estimated Effort:

- **P0 fixes:** 4-6 hours
- **P1 fixes:** 2-3 hours  
- **P2 improvements:** 1-2 days

**Total:** ~2-3 days of focused development work

---

## Appendix: Route Authorization Matrix

| Route | Method | Auth Check | Ownership Check | Membership Check | Status |
|-------|--------|------------|-----------------|-------------------|--------|
| `/api/athlete/create` | POST | ✅ | N/A | N/A | ✅ |
| `/api/athlete/hydrate` | POST | ✅ | ✅ (implicit) | N/A | ✅ |
| `/api/athlete/[id]` | GET | ✅ | ❌ | N/A | ❌ **FIX NEEDED** |
| `/api/athlete/[id]` | PUT | ✅ | ✅ | N/A | ✅ |
| `/api/athlete/[id]/profile` | PUT | ✅ | ✅ | N/A | ✅ |
| `/api/athlete/check-handle` | GET | ✅ | N/A | N/A | ✅ |
| `/api/runcrew/[id]` | GET | ✅ | ❌ | ❌ | ❌ **FIX NEEDED** |
| `/api/runcrew/[id]/announcements` | GET | ✅ | ❌ | ❌ | ❌ **FIX NEEDED** |
| `/api/runcrew/[id]/announcements` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/runcrew/[id]/messages` | GET | ✅ | ❌ | ❌ | ❌ **FIX NEEDED** |
| `/api/runcrew/[id]/messages` | POST | ✅ | ⚠️ | ⚠️ | ⚠️ **PARTIAL** |
| `/api/runcrew/[id]/runs` | GET | ✅ | ❌ | ❌ | ❌ **FIX NEEDED** |
| `/api/runcrew/[id]/runs` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/runcrew/create` | POST | ✅ | N/A | N/A | ✅ |
| `/api/runcrew/join` | POST | ✅ | N/A | N/A | ✅ |
| `/api/runcrew/hydrate` | POST | ✅ | ✅ (implicit) | ✅ | ✅ |
| `/api/garmin/sync` | POST | ✅ | ✅ (implicit) | N/A | ✅ |

**Legend:**
- ✅ = Properly implemented
- ❌ = Missing or incorrect
- ⚠️ = Partially implemented
- N/A = Not applicable

---

**Report Generated:** 2024-12-19  
**Auditor:** AI Assistant  
**Next Review:** After P0 fixes are implemented
