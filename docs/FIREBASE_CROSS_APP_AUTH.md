# Firebase Cross-App Authentication

**Date:** 2025-01-XX  
**Question:** How does Firebase auth work across GoFastCompany and gofastapp-mvp?

---

## 🔑 Key Answer

**YES - The Firebase project carries across both apps!**

Both apps use the **SAME Firebase project**, which is why authentication works.

---

## 📊 Firebase Project Configuration

### Same Firebase Project

**GoFastCompany:**
```typescript
// lib/firebase/client.ts
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!, // Same project!
};
```

**gofastapp-mvp:**
```typescript
// lib/firebase.ts
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "...",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "gofast-a5f94.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gofast-a5f94", // Same project!
  // ...
};
```

**Both use:** `projectId: "gofast-a5f94"` ✅

---

## 🔄 Authentication Flow

### Step 1: Admin Authenticates in GoFastCompany
```
GoFastCompany Admin
  ↓
Signs in via Firebase (project: gofast-a5f94)
  ↓
Gets Firebase ID Token
  ↓
Token is valid for project: gofast-a5f94
```

### Step 2: Token Sent to gofastapp-mvp
```
CreateRunModal (GoFastCompany)
  ↓
Gets Firebase token: await user.getIdToken()
  ↓
POSTs to gofastapp-mvp with header:
  Authorization: Bearer <firebase-token>
```

### Step 3: gofastapp-mvp Verifies Token
```
gofastapp-mvp /api/runs/create
  ↓
Extracts token from Authorization header
  ↓
Calls: adminAuth.verifyIdToken(token)
  ↓
Firebase Admin SDK verifies against project: gofast-a5f94
  ↓
✅ Token is valid! (same project)
```

---

## 🔐 Firebase Admin SDK

### Both Apps Use Same Admin Credentials

**GoFastCompany:**
```typescript
// lib/server/firebase-admin.ts
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID, // gofast-a5f94
    // ...
  }),
});
```

**gofastapp-mvp:**
```typescript
// lib/firebaseAdmin.ts
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID, // gofast-a5f94
    // ...
  }),
});
```

**Same project = Same token validation!** ✅

---

## ✅ Why This Works

### 1. **Same Firebase Project**
- Both apps use `gofast-a5f94`
- Tokens issued by one app are valid in the other
- Firebase Admin SDK verifies against the same project

### 2. **Token Portability**
- Firebase ID tokens are **project-scoped**
- Token from GoFastCompany → Valid in gofastapp-mvp (same project)
- Token contains: `uid`, `email`, `project_id: "gofast-a5f94"`

### 3. **No Cross-DB Auth Needed**
- We don't need staff model in gofastapp-mvp
- We just store `staffGeneratedId` as a string reference
- Authentication is handled by Firebase (shared project)

---

## 🎯 Summary

| Aspect | Answer |
|--------|--------|
| **Same Firebase Project?** | ✅ YES - `gofast-a5f94` |
| **Token Valid Across Apps?** | ✅ YES - Same project |
| **Admin SDK Same Project?** | ✅ YES - Both verify against `gofast-a5f94` |
| **Need Staff Model in gofastapp-mvp?** | ❌ NO - Just store ID as string |
| **Cross-DB Auth?** | ❌ NO - Firebase handles it |

---

## 🔍 Verification

**To verify both apps use same project:**

1. Check `NEXT_PUBLIC_FIREBASE_PROJECT_ID` env var
2. Check Firebase Admin `FIREBASE_PROJECT_ID` env var
3. Both should be: `gofast-a5f94`

**If different projects:**
- ❌ Tokens won't validate
- ❌ Cross-app auth won't work
- ❌ Need to use same Firebase project

---

## ✅ Current Status

**Both apps configured for:** `gofast-a5f94` ✅

**Authentication works because:**
- Same Firebase project
- Same token validation
- Firebase Admin SDK verifies against same project

**No additional setup needed!** ✅

