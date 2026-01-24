# Cross-Database Staff Mechanics

**Date:** 2025-01-XX  
**Question:** How do we handle staff from GoFastCompany DB when creating runs in gofastapp-mvp DB?

---

## 🔑 Key Insight

**We DON'T need a staff model in gofastapp-mvp!**

`staffGeneratedId` is just a **string reference** - not a foreign key, not a relation.

---

## 📊 Database Architecture

### GoFastCompany DB
```
CompanyStaff Table:
- id (UUID, PK) ← This is what we store
- firebaseId (String, unique)
- companyId (FK → GoFastCompany)
- role (enum)
```

### gofastapp-mvp DB
```
city_runs Table:
- id (cuid, PK)
- staffGeneratedId (String?, nullable) ← Just a string!
- athleteGeneratedId (String?, nullable)
- ... other fields
```

**No `staff` model/table in gofastapp-mvp!**

---

## 🔄 Flow Mechanics

### Step 1: GoFastCompany Admin Authenticates
```
GoFastCompany Admin
  ↓
Firebase Auth (same Firebase project)
  ↓
Authenticated in GoFastCompany app
```

### Step 2: Get Staff ID from GoFastCompany DB
```
CreateRunModal (GoFastCompany)
  ↓
Call: POST /api/staff/find-or-create (GoFastCompany's own API)
  ↓
Returns: { staff: { id: "uuid-123", ... } }
  ↓
staff.id = "uuid-123" (UUID from GoFastCompany DB)
```

### Step 3: Create Run in gofastapp-mvp DB
```
CreateRunModal (GoFastCompany)
  ↓
POST to gofastapp-mvp: /api/runs/create
  Body: {
    staffGeneratedId: "uuid-123", ← Just a string!
    runClub: {...},
    title: "...",
    ...
  }
  ↓
gofastapp-mvp /api/runs/create
  ↓
Saves to city_runs table:
  staffGeneratedId: "uuid-123" ← Stored as plain string
```

---

## ✅ Why This Works

### 1. **No Foreign Key Needed**
- `staffGeneratedId` is just a string reference
- No FK constraint = no cross-DB dependency
- gofastapp-mvp doesn't need to know about GoFastCompany's staff structure

### 2. **Denormalized Reference**
- We store the ID for auditing/tracking
- If we need staff details, we'd fetch from GoFastCompany API
- For MVP1, we just need to know "who created this run"

### 3. **Separation of Concerns**
- GoFastCompany = Admin/staff management
- gofastapp-mvp = Product/user-facing
- They're separate systems with separate databases

---

## 🎯 Current Implementation

### Schema (gofastapp-mvp)
```prisma
model city_runs {
  staffGeneratedId String? // Just a string - no FK!
  // ...
  @@index([staffGeneratedId]) // Can query by it, but no FK constraint
}
```

### API (gofastapp-mvp)
```typescript
// /api/runs/create
const run = await prisma.city_runs.create({
  data: {
    staffGeneratedId: staffGeneratedId, // Just store the string
    // ...
  },
});
```

### Usage
- **Auditing**: "Who created this run?" → Look up `staffGeneratedId` in GoFastCompany
- **Filtering**: Can filter runs by `staffGeneratedId` (indexed)
- **No validation**: We don't validate that staff exists (it's just a string)

---

## 🤔 Do We Need a Staff Model in gofastapp-mvp?

### Option 1: Current Approach (String Reference) ✅
**Pros:**
- ✅ Simple - no cross-DB dependencies
- ✅ No FK constraints
- ✅ No staff model needed
- ✅ Works for MVP1

**Cons:**
- ❌ Can't JOIN to get staff details
- ❌ No validation that staff exists
- ❌ If we need staff name/email, need to call GoFastCompany API

**Verdict:** ✅ **Perfect for MVP1**

### Option 2: Replicate Staff Model (Future)
**If we need staff details in gofastapp-mvp:**
- Create minimal `staff` table in gofastapp-mvp
- Sync staff data from GoFastCompany
- Use FK: `staffGeneratedId` → `staff.id`

**When to do this:**
- If we need to display "Created by: [Staff Name]" in gofastapp-mvp
- If we need staff details without calling GoFastCompany API
- If we need to query/filter by staff frequently

**Verdict:** ⏸️ **Not needed for MVP1**

---

## 📋 Summary

| Aspect | Current Approach |
|--------|------------------|
| **staffGeneratedId** | String (not FK) |
| **Staff Model** | ❌ None in gofastapp-mvp |
| **Validation** | ❌ None (just a string) |
| **Cross-DB Dependency** | ❌ None |
| **Use Case** | Auditing/tracking who created run |
| **MVP1 Status** | ✅ Works perfectly |

---

## ✅ Answer to User's Question

> "we're authoring on a different db that's not inside our db - how mechanically are we doing this"

**Answer:**
1. GoFastCompany gets staff ID from its own DB
2. Passes `staffGeneratedId` as a **string** to gofastapp-mvp
3. gofastapp-mvp stores it as a **plain string** (no FK, no model)
4. It's just a reference for auditing - no cross-DB dependency!

**No staff model needed in gofastapp-mvp for MVP1!** ✅

