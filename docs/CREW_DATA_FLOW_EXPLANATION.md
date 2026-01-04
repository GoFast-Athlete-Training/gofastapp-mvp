# Crew Data Flow Explanation

## The Issue: Why `crew.meta.name` instead of `crew.name`?

### The Flow

1. **Frontend calls API:**
```typescript
const response = await api.get(`/runcrew/${runCrewId}`);
const crewData = response.data.runCrew;
setCrew(crewData);  // ← Stores API response in state
```

2. **API route calls `hydrateCrew()`:**
```typescript
// app/api/runcrew/[id]/route.ts
const crew = await hydrateCrew(id);
return NextResponse.json({ success: true, runCrew: crew });
```

3. **`hydrateCrew()` returns box structure:**
```typescript
// lib/domain-runcrew.ts
export async function hydrateCrew(runCrewId: string) {
  const crew = await prisma.runCrew.findUnique({ ... });
  
  // Returns THIS structure (not flat):
  return {
    meta: {
      name: crew.name,        // ← name is INSIDE meta
      description: crew.description,
      // ...
    },
    membershipsBox: { ... },
    messagesBox: { ... },
    // ...
  };
}
```

### The Problem

**The API returns:**
```json
{
  "meta": {
    "name": "Boston Runners"
  },
  "membershipsBox": { ... }
}
```

**NOT:**
```json
{
  "name": "Boston Runners",  // ← This doesn't exist!
  "meta": { ... }
}
```

### Why `crew.name` Doesn't Work

```typescript
const [crew, setCrew] = useState<any>(null);

// After API call:
setCrew(crewData);  // crewData = { meta: { name: "..." }, ... }

// Later:
crew.name  // ❌ undefined! (doesn't exist)
crew.meta.name  // ✅ "Boston Runners" (correct)
```

---

## The Fix: Use What the API Returns

Since the API returns the box structure, we must access it correctly:

```typescript
// ✅ CORRECT - matches API structure
<h1>{crew.meta?.name}</h1>

// ❌ WRONG - name doesn't exist at top level
<h1>{crew.name}</h1>  // undefined!
```

---

## Why This Structure?

The backend organizes data into "boxes" for clarity:

```typescript
{
  meta: { ... },              // Basic crew info
  membershipsBox: { ... },     // All members
  messagesBox: { ... },        // All messages
  announcementsBox: { ... },   // All announcements
  runsBox: { ... },            // All runs
  joinCodesBox: { ... }        // All join codes
}
```

This makes it clear what type of data you're accessing.

---

## Is `crew` State or Hook?

**`crew` is state** (from `useState`), but:
- ✅ The **structure** comes from the **API response**
- ✅ The **API** uses `hydrateCrew()` which returns the box structure
- ✅ We just store what the API gives us

**It's NOT:**
- ❌ A hook pattern
- ❌ Arbitrary state structure
- ❌ Frontend-only organization

**It IS:**
- ✅ The actual structure returned by the backend
- ✅ Stored in React state for component use
- ✅ Consistent across all pages

---

## The Real Question

**Should we flatten the structure?**

**Option 1: Keep box structure (current)**
- ✅ Clear organization
- ✅ Matches backend design
- ✅ Consistent with other boxes
- ❌ Requires `crew.meta.name`

**Option 2: Flatten structure**
- ✅ Simpler access: `crew.name`
- ❌ Loses organization
- ❌ Would need to change backend `hydrateCrew()`

**Recommendation:** Keep box structure - it's intentional backend design.

