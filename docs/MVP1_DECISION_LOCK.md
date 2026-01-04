# MVP1 Decision Lock - RunCrew Assembly Pattern

**Date**: January 2025  
**Status**: ✅ **LOCKED** - No changes until MVP2

---

## Decision

**Explicit assembly functions are deferred to MVP2.**

We will continue using the current **fetch → setState → render** pattern for MVP1.

---

## Current State (Acknowledged)

✅ **Implicit assembly confirmed:**
- API responses stored raw in state
- JSX parses/filters raw API structures directly
- No assembly functions exist
- This is **intentional and acceptable for MVP1**

---

## MVP1 Guardrails

### ✅ Allowed
- JSX parsing raw API structures (current pattern)
- Direct access to `crew.runCrewBaseInfo.name`, `crew.membershipsBox.memberships`, etc.
- Simple conditional rendering based on state

### ⚠️ Guardrails (Do NOT)
- ❌ **Do NOT** increase JSX complexity beyond what exists
- ❌ **Do NOT** add deeper nesting in JSX
- ❌ **Do NOT** add conditional interpretation logic in JSX
- ❌ **Do NOT** add permission logic directly in JSX
- ❌ **Do NOT** expand repetitive JSX patterns

### 🚩 Red Flags (Flag Instead)
If JSX logic starts to feel:
- **Repetitive** → Flag it, don't expand it
- **Semantic** (deciding "what something means") → Flag it, don't expand it
- **Complex** → Flag it, don't expand it

**Action**: Flag for MVP2 assembly refactor instead of expanding JSX.

---

## Completed Cleanup

✅ **Rename complete:**
- `meta` → `runCrewBaseInfo` (where applicable)
- Reduces ambiguity
- Makes intent clearer: "core crew identity/configuration"

**Files updated:**
- `lib/domain-runcrew.ts` (source structure)
- `app/api/runcrew/[id]/route.ts` (PUT route)
- All RunCrew pages (member, admin, settings, home)

---

## Future: MVP2

**Explicit assembly will be introduced when:**
- RunCrew shapes stabilize
- Admin vs member semantics are settled
- Patterns are well-understood

**Assembly approach:**
- May start client-side first
- May move server-side later
- Will create explicit `assembleRunCrew*View()` functions

---

## Current Pattern (MVP1)

```typescript
// ✅ CURRENT PATTERN (Keep for MVP1)
const response = await api.get(`/runcrew/${runCrewId}`);
const crewData = response.data.runCrew;
setCrew(crewData);  // Raw API response

// JSX parses structure
const memberships = crew.membershipsBox?.memberships || [];
<h1>{crew.runCrewBaseInfo?.name}</h1>
```

**This is correct for MVP1. No changes needed.**

---

## Summary

- ✅ Behavior is correct
- ✅ Risks are understood
- ✅ Velocity is prioritized
- ✅ Guardrails are set
- ✅ Cleanup complete (meta → runCrewBaseInfo)
- ✅ MVP2 path is clear

**Status**: MVP1 direction locked. Proceed with current patterns.

