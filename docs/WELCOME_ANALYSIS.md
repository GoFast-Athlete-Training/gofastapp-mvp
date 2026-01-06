# Welcome Page Analysis - MVP1

## Current Problem

`/welcome` is doing too much:
1. ✅ Hydration (good)
2. ✅ Resolve memberships (good)  
3. ✅ Show RunCrew cards if user has crews (good)
4. ❌ Show "Join or Create" buttons if NO crews (BAD - breaks single responsibility)

## Two Use Cases

### Use Case 1: User HAS crews
**Current Flow:**
1. Welcome hydrates
2. Shows RunCrew cards
3. User clicks card → goes to `/runcrew/[id]`
✅ **This works fine**

### Use Case 2: User has NO crews
**Current Flow:**
1. Welcome hydrates
2. Shows "Join or Create" buttons ON welcome page
❌ **Problem:** Welcome becomes a navigation hub instead of just hydration

**Better Flow:**
1. Welcome hydrates
2. Detects 0 crews
3. **Redirects to `/runcrew`** (discovery page)
4. User can browse/search/join/create all in one place

## Solution

**`/welcome` should ONLY:**
- Hydrate athlete
- Resolve memberships
- If crews exist → show selector (stay on welcome)
- If NO crews → **redirect to `/runcrew`** (discovery page)

**`/runcrew` (discovery page) handles:**
- Browse/search crews
- Join via discovery
- Create new crew
- All join/create actions in one place

## Implementation

After hydration in `/welcome`:
```typescript
if (runCrewCards.length === 0) {
  // Redirect to discovery page instead of showing buttons
  router.replace('/runcrew');
  return;
}
```

## Benefits

1. **Single Responsibility:** Welcome = hydration only
2. **Better UX:** Discovery page has proper search/filter UI
3. **Cleaner:** No duplicate "join/create" buttons
4. **Consistent:** All crew discovery happens in one place

