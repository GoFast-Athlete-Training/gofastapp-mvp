# Workout Targets: Hardcoded vs Garmin Structure

## Garmin's Target Structure

Garmin uses:
- `targetType` - Enum with ~18 options: PACE, HEART_RATE, SPEED, CADENCE, POWER, GRADE, RESISTANCE, OPEN, etc.
- `targetValueLow` and `targetValueHigh` - Numeric values
- `secondaryTargetType` - Can have BOTH pace AND HR!

**Garmin values:**
- **PACE:** seconds per kilometer (numeric, e.g., 330 = 5:30/km)
- **HEART_RATE:** beats per minute (numeric, e.g., 160-180)
- **SPEED:** meters per second or km/h (numeric)
- **CADENCE:** steps per minute (numeric)
- **POWER:** watts (numeric)
- etc.

---

## Our Current Schema Proposal

```prisma
model workout_segments {
  paceTarget       String?           // e.g., "8:00/mile" (user-friendly format)
  hrMin            Int?              // Heart rate min (bpm)
  hrMax            Int?              // Heart rate max (bpm)
}
```

**Analysis:**

### hrMin/hrMax
- ✅ **NOT hardcoded** - These ARE what Garmin uses (bpm)
- ✅ Matches Garmin's `targetType: HEART_RATE` with `targetValueLow`/`targetValueHigh`
- ✅ This is correct

### paceTarget (String)
- ⚠️ **User-friendly format** - "8:00/mile" is easier than 480 seconds/km
- ✅ Garmin service converts to seconds/km for Garmin API
- ✅ This is fine - UX convenience, converted to Garmin format

---

## Question: Should We Support Other Target Types?

**Current:** Only pace and HR

**Garmin supports:** PACE, HEART_RATE, SPEED, CADENCE, POWER, GRADE, RESISTANCE, OPEN, etc.

**Options:**

### Option 1: Keep Simple (Current)
- Only pace and HR (most common for running)
- If user wants other targets, they can add later

### Option 2: Make Extensible
```prisma
model workout_segments {
  // Primary target
  targetType       String?           // "PACE", "HEART_RATE", "SPEED", "CADENCE", etc.
  targetValueLow   Float?
  targetValueHigh  Float?
  
  // Secondary target (can have BOTH pace AND HR)
  secondaryTargetType    String?
  secondaryTargetValueLow  Float?
  secondaryTargetValueHigh Float?
  
  // UX convenience fields (optional, for display)
  paceTarget       String?           // "8:00/mile" - converted to targetValueLow/High
  hrMin            Int?              // Converted to targetValueLow/High if targetType=HEART_RATE
  hrMax            Int?
}
```

**Recommendation:** Start simple (Option 1) - pace and HR cover 95% of running workouts. Can add other target types later if needed.

---

## Final Answer

- **hrMin/hrMax:** ✅ NOT hardcoded - these ARE Garmin's format (bpm)
- **paceTarget:** ✅ User-friendly string, converted to Garmin format (seconds/km)
- **Are they hardcoded?** No - they're the actual targets Garmin uses, just stored in user-friendly format

**Current proposal is correct** - pace and HR are the main targets for running workouts.
