# **RUNCREW JOIN ARCHITECTURE AUDIT**

**Date:** Based on codebase inspection  
**Scope:** Complete factual audit of RunCrew join flow implementation  
**Methodology:** Direct code inspection, no speculation

---

## **1. JOIN PAGE INSPECTION**

**File:** `app/runcrew/join/page.tsx`

**Type:** CLIENT PAGE

**Findings:**
- ✅ **Does NOT read query params** — No `useSearchParams()` or query param reading code exists
- ✅ **Accepts `joinCode` manually** — User input field (line 12, 47)
- ❌ **Does NOT hydrate crew info** — No API call to fetch crew data before showing form
- ✅ **Redirects after join** — On success, redirects to `/runcrew/${response.data.runCrew.id}` (line 22)
- ✅ **Triggers API internally** — Calls `POST /api/runcrew/join` with `{ joinCode }` (line 19)
- ✅ **Uses `joinCode` only** — No `crewId` support
- ❌ **No authentication check** — Page does not verify user is authenticated before showing form

---

## **2. API ROUTE INSPECTION**

### **2.1 POST /api/runcrew/join**

**File:** `app/api/runcrew/join/route.ts`

**HTTP Method:** POST

**Request Body:** `{ joinCode: string }` (line 41)

**Uses:** `joinCode` only (NOT `crewId`)

**Authentication:** ✅ REQUIRED — Bearer token in Authorization header (lines 15-18, 20-25)

**Response Shape:** `{ success: true, runCrew: crew }` (line 58)

**Internal Function Calls:** 
- `getAthleteByFirebaseId(firebaseId)` (line 31)
- `joinCrew(joinCode, athlete.id)` (line 52)

**Fields Read:** `joinCode` from request body

**Fields Written:** Creates `RunCrewMembership` record (via `joinCrew`)

---

### **2.2 POST /api/runcrew/hydrate**

**File:** `app/api/runcrew/hydrate/route.ts`

**HTTP Method:** POST

**Request Body:** `{ runCrewId: string }` (line 41)

**Uses:** `runCrewId` (NOT `joinCode`)

**Authentication:** ✅ REQUIRED — Bearer token in Authorization header (lines 15-18, 20-25)

**Response Shape:** `{ success: true, runCrew: crew }` (line 66)

**Internal Function Calls:**
- `getAthleteByFirebaseId(firebaseId)` (line 31)
- `hydrateCrew(runCrewId, athlete.id)` (line 52)

**Fields Read:** `runCrewId` from request body

**Fields Written:** None (read-only operation)

---

### **2.3 GET /api/runcrew/[id]**

**File:** `app/api/runcrew/[id]/route.ts`

**HTTP Method:** GET

**Request Body:** None

**Uses:** Route param `id` (crewId) (line 13)

**Authentication:** ✅ REQUIRED — Bearer token in Authorization header (lines 18-21, 23-28)

**Membership Check:** ✅ REQUIRED — Returns 403 if user is not a member (lines 56-62)

**Response Shape:** `{ success: true, runCrew: crew }` (line 64)

**Internal Function Calls:**
- `getAthleteByFirebaseId(firebaseId)` (line 34)
- `hydrateCrew(id, athlete.id)` (line 46)

**Fields Read:** Route param `id`

**Fields Written:** None (read-only operation)

---

### **2.4 POST /api/runcrew/create**

**File:** `app/api/runcrew/create/route.ts`

**HTTP Method:** POST

**Request Body:** `{ name: string, description?: string, joinCode: string }` (line 41)

**Uses:** `joinCode` (user-provided, NOT auto-generated)

**Authentication:** ✅ REQUIRED — Bearer token in Authorization header (lines 15-18, 20-25)

**Response Shape:** `{ success: true, runCrew: crew }` (line 63)

**Internal Function Calls:**
- `getAthleteByFirebaseId(firebaseId)` (line 31)
- `createCrew({ name, description, joinCode, athleteId })` (line 52)

**Fields Read:** `name`, `description`, `joinCode` from request body

**Fields Written:** 
- Creates `RunCrew` record
- Creates `RunCrewMembership` record
- Creates `RunCrewManager` record with role 'admin'

**JoinCode Generation:** ❌ NOT automatic — Must be provided by user

---

### **2.5 Other API Routes**

**GET/POST /api/runcrew/[id]/messages** — Requires auth + membership  
**GET/POST /api/runcrew/[id]/announcements** — Requires auth + membership  
**GET/POST /api/runcrew/[id]/runs** — Requires auth + membership

**❌ No public endpoints** — All routes require authentication

---

## **3. DOMAIN SERVICE INSPECTION**

**File:** `lib/domain-runcrew.ts`

### **3.1 joinCrew()**

**Line:** 38

**Arguments:** `joinCode: string, athleteId: string`

**Uses:** `joinCode` (NOT `crewId`)

**Logic:**
1. Finds crew by `joinCode` (line 40-42)
2. Checks if membership already exists (lines 49-56)
3. If exists, returns crew (line 59)
4. If not, creates `RunCrewMembership` (lines 63-68)

**Supports joining without prior authentication:** ❌ NO — Requires `athleteId` parameter

**Fields Read:** `joinCode` from `RunCrew` table

**Fields Written:** `RunCrewMembership` record

---

### **3.2 hydrateCrew()**

**Line:** 73

**Arguments:** `runCrewId: string, athleteId?: string`

**Uses:** `runCrewId` (NOT `joinCode`)

**Logic:**
1. Finds crew by `id` (line 74-75)
2. Includes memberships, managers, messages, announcements, runs (lines 76-161)
3. Determines user role if `athleteId` provided (lines 169-175)
4. Returns crew with `userRole` field (lines 177-180)

**Supports joining without prior authentication:** ❌ NO — Does not create membership, only reads data

**Fields Read:** All crew-related data

**Fields Written:** None (read-only operation)

---

### **3.3 getCrewById()**

**Line:** 183

**Arguments:** `runCrewId: string`

**Uses:** `runCrewId`

**Logic:**
1. Finds crew by `id` (line 184-186)
2. Returns basic crew data (no includes)

**Supports joining without prior authentication:** ❌ NO — Read-only, does not create membership

**Fields Read:** Basic `RunCrew` fields

**Fields Written:** None

---

### **3.4 createCrew()**

**Line:** 3

**Arguments:** `{ name: string, description?: string, joinCode: string, athleteId: string }`

**Uses:** `joinCode` (user-provided)

**Logic:**
1. Creates `RunCrew` record (lines 10-16)
2. Creates `RunCrewMembership` (lines 19-24)
3. Creates `RunCrewManager` with role 'admin' (lines 27-33)

**JoinCode Generation:** ❌ NOT automatic — Must be provided

**Fields Written:** `RunCrew`, `RunCrewMembership`, `RunCrewManager` records

---

## **4. AUTH + REDIRECT LOGIC**

**File:** `app/signup/page.tsx`

**Findings:**

- ❌ **Does NOT read query params** — No `useSearchParams()` or query param reading code exists
- ❌ **Does NOT support returnUrl** — No `returnUrl` handling code exists
- ❌ **Does NOT support runcrew join flows** — No `crewId` or `joinCode` handling code exists
- ✅ **Redirect-after-login exists** — But hardcoded:
  - Profile complete → `/athlete-home` (lines 54, 164, 271, 370)
  - Profile incomplete → `/athlete-welcome` (lines 57, 167, 274, 373)
- ❌ **Join flows NOT handled automatically** — No logic to redirect to join page after auth

**No separate signin page** — Signup page handles both signup and signin modes (line 17)

**No redirect preservation** — Query params are lost on redirect

---

## **5. URL + ROUTER HANDLING**

### **5.1 app/runcrew/page.tsx**

**Type:** CLIENT PAGE

**Route Params:** None

**Query Params:** None

**Requires Membership:** No (landing page)

**Public Access:** Yes (no auth check)

**CTAs:**
- "Join Crew" → `/runcrew/join` (line 22)
- "Create Crew" → `/runcrew/create` (line 35)

**❌ No param-based links** — CTAs do not accept `crewId` or `joinCode` params

---

### **5.2 app/runcrew/join/page.tsx**

**Type:** CLIENT PAGE

**Route Params:** None

**Query Params:** None (does not read them)

**Requires Membership:** No

**Public Access:** Yes (no auth check, but API call requires auth)

**Behavior:** Manual `joinCode` input form

---

### **5.3 app/runcrew/[id]/page.tsx**

**Type:** CLIENT PAGE

**Route Params:** `id` (crewId) (line 13)

**Query Params:** None

**Requires Membership:** ✅ Yes (API call requires membership, line 24)

**Public Access:** ❌ No (requires auth + membership)

**Behavior:** Loads crew via `POST /api/runcrew/hydrate` (line 24)

---

### **5.4 app/runcrew/create/page.tsx**

**Type:** CLIENT PAGE

**Route Params:** None

**Query Params:** None

**Requires Membership:** No

**Public Access:** Yes (no auth check, but API call requires auth)

**Behavior:** Form to create crew with manual `joinCode` input

---

### **5.5 app/runcrew/[id]/admin/page.tsx**

**Type:** CLIENT PAGE

**Route Params:** `id` (crewId) (line 12)

**Requires Membership:** ✅ Yes (API call requires membership)

**Public Access:** ❌ No

---

### **5.6 app/runcrew/[id]/settings/page.tsx**

**Type:** CLIENT PAGE

**Route Params:** `id` (crewId) (line 12)

**Requires Membership:** ✅ Yes (API call requires membership)

**Public Access:** ❌ No

---

### **5.7 app/runcrew/success/page.tsx**

**Type:** CLIENT PAGE

**Route Params:** None

**Query Params:** None

**Requires Membership:** No

**Public Access:** Yes

**Behavior:** Generic success page, redirects to `/home` (line 22)

---

## **6. FINAL SUMMARY**

### **6.1 What the Repo Currently Supports**

#### **✅ Static Manual Join**
- **Supported:** YES
- **Implementation:** `/runcrew/join` page accepts manual `joinCode` input
- **Flow:** User enters `joinCode` → `POST /api/runcrew/join` → redirects to crew page
- **Limitation:** Requires user to be authenticated before API call

#### **❌ Param-Based Join by crewId**
- **Supported:** NO
- **Missing:**
  - Join page does not read `crewId` from query params
  - No API endpoint to join by `crewId` (only `joinCode`)
  - No public endpoint to fetch crew info by `crewId` without auth

#### **❌ Param-Based Join by joinCode**
- **Supported:** NO
- **Missing:**
  - Join page does not read `joinCode` from query params
  - No pre-population of form with `joinCode` from URL

#### **❌ URL Onboarding**
- **Supported:** NO
- **Missing:**
  - No redirect preservation in auth flow
  - No `returnUrl` handling in signup/signin
  - No automatic join after authentication

#### **❌ Invite-Link Generation**
- **Supported:** NO
- **Missing:**
  - No automatic `joinCode` generation (must be manually provided)
  - No invite link generation logic
  - No shareable URL format

---

### **6.2 What Is Missing (Based on Actual Code Inspection)**

1. **Query param reading in `/app/runcrew/join/page.tsx`**
   - No `useSearchParams()` import or usage
   - No reading of `crewId` or `joinCode` from URL

2. **Public crew fetch endpoint**
   - No `GET /api/runcrew/[id]/public` or similar
   - All endpoints require authentication

3. **Join by `crewId` API support**
   - `POST /api/runcrew/join` only accepts `joinCode`
   - No endpoint to join by `crewId` directly

4. **Redirect preservation in auth flow**
   - `app/signup/page.tsx` does not read or preserve query params
   - No `returnUrl` handling

5. **Automatic join after auth**
   - No logic to check for pending join after successful authentication
   - No redirect to join page with preserved params

6. **JoinCode auto-generation**
   - `createCrew()` requires `joinCode` to be provided
   - No automatic generation logic

7. **Crew info hydration before join**
   - Join page does not fetch crew data before showing form
   - No preview of crew name/description

---

### **6.3 Exact File-Level Gaps**

**Files that exist but lack required functionality:**

1. **`app/runcrew/join/page.tsx`**
   - Missing: `useSearchParams()` to read `crewId` or `joinCode`
   - Missing: API call to fetch crew info if `crewId` present
   - Missing: Auth check before showing form

2. **`app/signup/page.tsx`**
   - Missing: Query param reading (`returnUrl`, `crewId`, `joinCode`)
   - Missing: Redirect preservation logic
   - Missing: Post-auth join flow handling

3. **`app/api/runcrew/join/route.ts`**
   - Missing: Support for `crewId` parameter (currently only `joinCode`)

**Files that do not exist:**

1. `app/api/runcrew/[id]/public/route.ts` (or similar public endpoint)
2. No server action for public crew fetch
3. No invite link generation utility

---

**AUDIT COMPLETE** — All findings based on actual code inspection. No speculation or theoretical analysis included.
