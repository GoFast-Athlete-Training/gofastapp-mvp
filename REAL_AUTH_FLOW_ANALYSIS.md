# 🔍 REAL AUTH FLOW ANALYSIS
## Verified from `gofastfrontend-mvp1` + `gofastbackendv2-fall2025`

---

## A. FIREBASE AUTH FLOW

### **Entry Point: `/` (Splash.jsx)**
**File:** `gofastfrontend-mvp1/src/Pages/Splash.jsx`

```javascript
// 1. Checks Firebase auth state
auth.onAuthStateChanged((user) => {
  if (user) {
    navigate('/athlete-welcome');  // Authenticated → Welcome
  } else {
    navigate('/athletesignup');    // Not authenticated → Signup
  }
});
```

**Flow:**
- Shows logo for 2 seconds
- Checks `auth.onAuthStateChanged`
- Routes based on auth state
- **NO backend calls**
- **NO hydration**

---

### **Signup Page: `/athletesignup` (AthleteSignup.jsx)**
**File:** `gofastfrontend-mvp1/src/Pages/Athlete/AthleteSignup.jsx`

**What triggers Firebase login:**
- User clicks "Sign up with Google" button
- Calls `signInWithGoogle()` from `firebase.js`

**Firebase Login Process:**
```javascript
// 1. Google popup sign-in
const result = await signInWithGoogle();  // signInWithPopup(auth, googleProvider)

// 2. Get Firebase ID token
const firebaseToken = await auth.currentUser.getIdToken();

// 3. Store token in localStorage
localStorage.setItem("firebaseToken", firebaseToken);
```

**Data taken from Firebase:**
- `result.uid` → Firebase UID
- `result.email` → Email
- `result.name` → Display name (parsed into firstName/lastName)
- `result.photoURL` → Profile photo

**Where sign-in redirects:**
- **AFTER** `/api/athlete/create` call (see section B)
- Routes based on `gofastHandle`:
  - If `gofastHandle` exists → `/athlete-home`
  - If `gofastHandle` is null → `/athlete-create-profile`

---

### **Signin Page: `/athletesignin` (AthleteSignin.jsx)**
**File:** `gofastfrontend-mvp1/src/Pages/Athlete/AthleteSignin.jsx`

**Flow:**
- Same Firebase login process as signup
- Calls `/api/athlete/create` (NOT `/api/athlete/find`)
- Routes based on `gofastHandle`:
  - If `gofastHandle` exists → `/athlete-welcome`
  - If `gofastHandle` is null → `/athlete-create-profile`

---

## B. ATHLETE CREATION LOGIC

### **Which file calls `/api/athlete/create`?**

**Called from:**
1. `AthleteSignup.jsx` (line 35)
2. `AthleteSignin.jsx` (line 31)
3. `AthleteCreateProfile.jsx` (line 100) - during profile submission
4. `JoinCrewAthSignup.jsx` (line 55) - join flow

### **When is this call triggered?**

**Timing:**
- **IMMEDIATELY after** Firebase sign-in popup succeeds
- **BEFORE** any hydration
- **BEFORE** profile setup
- **BEFORE** routing decisions

**Sequence:**
```
1. Firebase signInWithPopup() → success
2. Get Firebase token → user.getIdToken()
3. Store token in localStorage
4. POST /api/athlete/create  ← CALLED HERE
5. Check response for gofastHandle
6. Route based on gofastHandle
```

### **What exact payload is used?**

**Payload:**
```javascript
// From AthleteSignup.jsx
const requestBody = hasJoinContext && joinSessionId 
  ? { sessionId: joinSessionId }  // Only if joining a crew
  : {};  // Empty body for normal signup

await api.post("/athlete/create", requestBody);
```

**Token:**
- Firebase ID token is **automatically injected** by Axios interceptor
- Header: `Authorization: Bearer <firebaseToken>`
- No manual token passing needed

### **Does creation happen before hydration?**

**YES - Creation ALWAYS happens before hydration**

**Order:**
1. ✅ Firebase sign-in
2. ✅ `/api/athlete/create` (find or create athlete)
3. ✅ Store `athleteId` in localStorage
4. ❌ Hydration happens later (in `/athlete-welcome`)

### **How does company creation/upsert work?**

**IMPORTANT FINDING:**
- **MVP1 does NOT call `/api/company/create` or `/api/company/init`**
- Backend uses **hardcoded company ID** from config
- **No company creation in frontend flow**

**Backend Pattern:**
```javascript
// gofastbackendv2-fall2025/config/goFastCompanyConfig.js
export const GOFAST_COMPANY_ID = 'cmhpqe7kl0000nw1uvcfhf2hs';

// Athlete creation does NOT link to company
// Company is managed separately via CompanyStaff routes
```

**Athlete Schema:**
- MVP1 backend does NOT have `companyId` on Athlete model
- Athletes are created without company association
- Company is a separate entity for staff/management

---

## C. HYDRATION FLOW

### **Where does `/api/athlete/hydrate` get called from?**

**Called from:**
1. `AthleteWelcome.jsx` (line 36) - **PRIMARY hydration point**
2. `Welcome.jsx` (line 26) - Legacy/alternative welcome

**File:** `gofastfrontend-mvp1/src/Pages/Athlete/AthleteWelcome.jsx`

### **What triggers hydration?**

**Trigger:**
- Page mount (`useEffect`)
- **ONLY** if Firebase user exists
- If no Firebase user → redirect to `/athletesignup`

**Code:**
```javascript
useEffect(() => {
  const hydrateAthlete = async () => {
    const firebaseUser = auth.currentUser;
    
    if (!firebaseUser) {
      navigate('/athletesignup');
      return;
    }
    
    // Call hydration
    const response = await api.post('/athlete/hydrate');
    // ...
  };
  
  hydrateAthlete();
}, [navigate]);
```

### **What state must exist before hydration?**

**Prerequisites:**
1. ✅ Firebase user authenticated (`auth.currentUser` exists)
2. ✅ Firebase token available (for API interceptor)
3. ✅ Athlete record exists in DB (created via `/api/athlete/create`)

**NOT required:**
- ❌ `gofastHandle` (hydration works without it)
- ❌ Profile completion
- ❌ Company association

### **What does the backend return?**

**Response Structure:**
```javascript
{
  success: true,
  athlete: {
    athleteId: "...",
    firebaseId: "...",
    email: "...",
    firstName: "...",
    lastName: "...",
    gofastHandle: "...",
    // ... all athlete fields
    
    // RunCrew data
    runCrews: [...],           // Array of crew memberships
    runCrewCount: 0,
    MyCrew: "...",             // Primary crew ID
    MyCrewManagerId: "...",    // Manager record ID
    
    // Activities
    weeklyActivities: [...],   // Last 7 days
    weeklyTotals: {
      totalDistanceMiles: "...",
      totalDuration: "...",
      totalCalories: "...",
      activityCount: 0
    }
  }
}
```

**Storage:**
- Frontend calls `LocalStorageAPI.setFullHydrationModel({ athlete, weeklyActivities, weeklyTotals })`
- Stores complete Prisma model in localStorage

---

## D. REDIRECT / ROUTING FLOW

### **After login → what page?**

**Flow:**
```
Firebase sign-in success
  ↓
POST /api/athlete/create
  ↓
Check response.data.gofastHandle
  ↓
IF gofastHandle exists:
  → /athlete-welcome (signin) OR /athlete-home (signup)
ELSE:
  → /athlete-create-profile
```

**Code from AthleteSignin.jsx:**
```javascript
if (athlete.data?.gofastHandle) {
  navigate("/athlete-welcome");  // Existing user with profile
} else {
  navigate("/athlete-create-profile");  // New user or incomplete
}
```

### **After athlete creation → what page?**

**Same as above** - routing happens immediately after `/api/athlete/create` response

### **After hydration → what page?**

**From AthleteWelcome.jsx:**
- Hydration completes
- Shows "Let's Train!" button
- User clicks button → `/athlete-home`
- **NO automatic redirect** - user must click button

**Code:**
```javascript
const handleLetsTrain = () => {
  navigate('/athlete-home');
};
```

### **What conditions decide these redirects?**

**Decision Tree:**

```
1. Firebase Auth Check (Splash)
   ├─ No user → /athletesignup
   └─ User exists → /athlete-welcome

2. After Signup/Signin
   ├─ gofastHandle exists → /athlete-welcome OR /athlete-home
   └─ gofastHandle missing → /athlete-create-profile

3. After Hydration (Welcome)
   └─ User clicks button → /athlete-home

4. Profile Setup Complete
   └─ Always → /athlete-home
```

---

## E. PROFILE SETUP / HANDLE SETUP

### **Does MVP1 have a dedicated profile page?**

**YES:** `/athlete-create-profile` (AthleteCreateProfile.jsx)

**File:** `gofastfrontend-mvp1/src/Pages/Athlete/AthleteCreateProfile.jsx`

### **Where is gofast handle collected?**

**In profile form:**
- Required field in `AthleteCreateProfile.jsx`
- User enters handle (e.g., "@username")
- Validated for uniqueness on backend
- Stored via `PUT /api/athlete/:id/profile`

**Required Fields:**
```javascript
firstName: required
lastName: required
gofastHandle: required  // ← KEY INDICATOR
birthday: required
gender: required
city: required
state: required
primarySport: required
```

### **What fields are required before entering the app?**

**MVP1 Pattern:**
- **gofastHandle is the KEY indicator**
- If `gofastHandle` is null/empty → route to profile setup
- If `gofastHandle` exists → allow entry to app

**Profile Setup Flow:**
```javascript
// 1. Call /api/athlete/create (ensure athlete exists)
const res = await api.post('/athlete/create');
const athleteId = res.data.athleteId;

// 2. Update profile with all fields
await api.put(`/athlete/${athleteId}/profile`, {
  firstName,
  lastName,
  gofastHandle,  // ← Required
  birthday,
  gender,
  city,
  state,
  primarySport,
  // ... optional fields
});

// 3. Navigate to home
navigate('/athlete-home');
```

---

## F. DATA MODEL RELATIONSHIP (BACKEND)

### **How does Athlete relate to Company?**

**IMPORTANT FINDING:**
- **MVP1 Athlete model does NOT have `companyId`**
- Athletes are **NOT** linked to GoFastCompany
- Company is a **separate entity** for staff/management only

**Backend Schema (from analysis):**
```prisma
model Athlete {
  id           String   @id @default(cuid())
  firebaseId   String   @unique
  email        String   @unique
  // ... NO companyId field
}

model GoFastCompany {
  id          String   @id
  companyName String
  // ... company fields
  // Linked to CompanyStaff, NOT Athlete
}
```

### **How is Company created?**

**Backend Route:** `POST /api/company/create`
- **NOT called from frontend auth flow**
- Only called by staff/admin users
- Uses hardcoded company ID from config
- Single-tenant pattern (one company forever)

**Config:**
```javascript
// gofastbackendv2-fall2025/config/goFastCompanyConfig.js
export const GOFAST_COMPANY_ID = 'cmhpqe7kl0000nw1uvcfhf2hs';
```

### **When is the relationship assigned?**

**Answer: NEVER in MVP1**
- Athletes are created without company
- Company is for staff/management only
- Athletes exist independently

---

## 📋 SUMMARY: EXACT CONTRACT FOR NEW APP

### **1. Entry Point (`/`)**
- Check Firebase auth state
- If user → `/athlete-welcome`
- If no user → `/signup`
- **NO backend calls**
- **NO hydration**

### **2. Signup/Signin Pages**
- Firebase `signInWithPopup()` with Google
- Get Firebase token → `user.getIdToken()`
- Store token in localStorage
- **IMMEDIATELY call** `POST /api/athlete/create` (empty body or `{ sessionId }`)
- Token auto-injected by Axios interceptor
- Route based on `response.data.gofastHandle`:
  - Exists → `/athlete-welcome` (signin) or `/athlete-home` (signup)
  - Missing → `/athlete-create-profile`

### **3. Welcome Page (`/athlete-welcome`)**
- Check Firebase user exists
- If not → redirect to `/signup`
- Call `POST /api/athlete/hydrate` (no body, token auto-injected)
- Store response via `LocalStorageAPI.setFullHydrationModel()`
- Show "Let's Train!" button
- **NO automatic redirect** - user clicks button → `/home`

### **4. Profile Setup (`/athlete-create-profile`)**
- Call `POST /api/athlete/create` (ensure athlete exists)
- Update profile via `PUT /api/athlete/:id/profile`
- Required: `firstName`, `lastName`, `gofastHandle`, `birthday`, `gender`, `city`, `state`, `primarySport`
- After success → navigate to `/athlete-home`

### **5. Home Page (`/athlete-home`)**
- Read from localStorage (cached hydration data)
- If no athlete in cache → redirect to `/athlete-welcome`
- Optionally call `POST /api/runcrew/hydrate` for crew data

### **6. Company Handling**
- **DO NOT call `/api/company/init` or `/api/company/create` in auth flow**
- MVP1 does NOT link athletes to company
- Company is separate entity (if needed later)

---

## 🔑 KEY DIFFERENCES FROM CURRENT IMPLEMENTATION

1. **Company Creation:** MVP1 does NOT create company during auth
2. **Athlete Creation Timing:** Happens IMMEDIATELY after Firebase sign-in, BEFORE hydration
3. **Welcome Page:** Shows button, NO automatic redirect
4. **Profile Check:** Uses `gofastHandle` as indicator, not `firstName`
5. **Hydration:** Only happens in `/athlete-welcome`, not in signup/signin

---

**END OF ANALYSIS**

