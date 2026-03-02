# Target Type Decision: Generic vs Specific Fields

## The Question

**Option A: Specific fields (current proposal)**
```prisma
paceTarget       String?           // "8:00/mile"
hrMin            Int?
hrMax            Int?
```

**Option B: Generic structure (matches Garmin)**
```prisma
targetType       String?           // "PACE", "HEART_RATE", "SPEED", etc.
targetValueLow   Float?
targetValueHigh  Float?
secondaryTargetType    String?
secondaryTargetValueLow  Float?
secondaryTargetValueHigh Float?
```

---

## Garmin Supports ~18 Target Types

From Garmin API schema:
- PACE
- HEART_RATE
- SPEED
- CADENCE
- POWER
- GRADE
- RESISTANCE
- OPEN (no target)
- ... and more (18 total)

**Plus:** Can have BOTH primary and secondary targets (e.g., pace AND HR)

---

## Analysis

### Option A: Specific Fields (paceTarget, hrMin, hrMax)
**Pros:**
- User-friendly (paceTarget as "8:00/mile")
- Simple for common cases (pace + HR)

**Cons:**
- ❌ Hardcoded to only pace and HR
- ❌ Can't support other target types (SPEED, CADENCE, POWER, etc.)
- ❌ Service has to convert paceTarget string → Garmin format
- ❌ Not extensible

### Option B: Generic Structure (targetType + values)
**Pros:**
- ✅ Matches Garmin's structure exactly
- ✅ Supports ALL 18 target types
- ✅ Can have primary + secondary targets
- ✅ Extensible - add new target types without schema changes
- ✅ Service just passes through (no conversion needed)

**Cons:**
- ⚠️ Less user-friendly (need to convert pace string to seconds/km)
- ⚠️ More generic/abstract

---

## Recommendation: Option B (Generic Structure)

**Why:**
1. Matches Garmin exactly - no conversion needed
2. Supports all target types Garmin supports
3. Not hardcoded - extensible
4. Can add UX convenience layer later (pace string → seconds/km conversion in UI)

**Schema:**
```prisma
model workout_segments {
  // Primary target
  targetType       String?           // "PACE", "HEART_RATE", "SPEED", "CADENCE", "POWER", etc.
  targetValueLow   Float?
  targetValueHigh  Float?
  
  // Secondary target (can have BOTH pace AND HR!)
  secondaryTargetType    String?
  secondaryTargetValueLow  Float?
  secondaryTargetValueHigh Float?
}
```

**UX Layer:** Convert user input (e.g., "8:00/mile") → targetValueLow/High in the UI/form, store generic structure in DB.

---

## Decision Needed

**Do we:**
1. Match Garmin's generic structure (targetType + values) - extensible, supports all types
2. Keep specific fields (paceTarget, hrMin, hrMax) - simpler UX but hardcoded

**Recommendation:** Match Garmin's structure - it's not hardcoded and supports everything Garmin supports.
