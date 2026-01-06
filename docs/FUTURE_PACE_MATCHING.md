# Future Pace Matching & Filtering - Post MVP1

**Status:** 📋 Planned  
**Priority:** Post-MVP1  
**Date:** 2025-01-XX

---

## Overview

Current MVP1 implementation treats pace as a **display attribute only** on crew cards. This document outlines future enhancements for pace-based matching and filtering.

---

## Current State (MVP1)

**Pace Fields:**
- `paceAverage` - Average pace (e.g., "8:00")
- `easyMilesPace` - Jogging/easy pace (e.g., "9:30")
- `crushingItPace` - Tempo/hard pace (e.g., "7:00")

**Current Behavior:**
- Pace is displayed on crew cards as an attribute
- No pace filtering on discovery page
- No pace-based matching logic

---

## Future Use Cases

### 1. 5K Pace Matching (±30 seconds)

**Use Case:** Match runners based on their 5K race pace with a 30-second tolerance window.

**Implementation:**
- Add `fiveKPace` field to `Athlete` model (already exists in schema)
- Add `fiveKPace` field to `run_crews` model (optional)
- Filter crews where: `crew.fiveKPace` is within ±30 seconds of `athlete.fiveKPace`

**Example:**
```
Athlete 5K pace: 20:00 (6:26 min/mile)
Crew 5K pace range: 19:30 - 20:30 (6:16 - 6:36 min/mile)
Match: ✅ Within 30-second window
```

**Query Logic:**
```typescript
if (athlete.fiveKPace && crew.fiveKPace) {
  const paceDiff = Math.abs(athlete.fiveKPace - crew.fiveKPace);
  if (paceDiff <= 30) { // 30 seconds
    // Match
  }
}
```

---

### 2. Pace-Based Discovery Filtering

**Use Case:** Allow users to filter crews by pace range on discovery page.

**Implementation:**
- Add pace filter inputs back to discovery page
- Filter by `paceAverage` (or use all three pace fields)
- Support range queries: "Show crews with average pace between X and Y"

**UI:**
```
Pace Filter:
[Min: 7:00] [Max: 9:00] min/mile
```

**Query:**
```typescript
where: {
  paceAverage: {
    gte: minPace,
    lte: maxPace,
  }
}
```

---

### 3. Multi-Pace Field Filtering

**Use Case:** Filter crews based on any of the three pace fields (average, easy, tempo).

**Options:**
- Filter by `paceAverage` only (simplest)
- Filter by `easyMilesPace` (for recovery runs)
- Filter by `crushingItPace` (for tempo/training runs)
- Filter by any pace field within range

**Implementation:**
```typescript
where: {
  OR: [
    { paceAverage: { gte: minPace, lte: maxPace } },
    { easyMilesPace: { gte: minPace, lte: maxPace } },
    { crushingItPace: { gte: minPace, lte: maxPace } },
  ]
}
```

---

### 4. Pace Compatibility Scoring

**Use Case:** Score crews based on how well their pace matches the user's pace profile.

**Scoring Algorithm:**
1. Compare athlete's `fiveKPace` to crew's pace fields
2. Calculate compatibility score (0-100)
3. Sort crews by compatibility score

**Example:**
```
Athlete 5K: 20:00 (6:26/mile)
Crew average: 8:00/mile → Score: 60 (too slow)
Crew average: 6:30/mile → Score: 95 (good match)
Crew average: 5:30/mile → Score: 40 (too fast)
```

---

### 5. Pace Range Display Enhancement

**Use Case:** Show pace range on cards using all three pace fields.

**Current:** "8:00 min/mile avg"

**Future Options:**
- "Easy: 9:30 | Avg: 8:00 | Tempo: 7:00"
- "8:00 avg (9:30 easy, 7:00 tempo)"
- Visual pace bar showing range

---

## Data Model Considerations

### Current Schema
```prisma
model run_crews {
  paceAverage     String?  // e.g., "8:00"
  easyMilesPace   String?  // e.g., "9:30"
  crushingItPace  String?  // e.g., "7:00"
}

model Athlete {
  fiveKPace       String?  // Already exists
}
```

### Future Additions
```prisma
model run_crews {
  fiveKPace       String?  // Add for matching
  paceMinSeconds  Int?     // Converted for filtering
  paceMaxSeconds  Int?     // Converted for filtering
}
```

---

## Implementation Priority

1. **Phase 1 (Post-MVP1):** 5K pace matching (±30s)
   - Add `fiveKPace` to `run_crews`
   - Implement matching logic
   - Show "compatible" badge on cards

2. **Phase 2:** Pace filtering on discovery
   - Add filter UI back
   - Filter by `paceAverage` range
   - Simple min/max inputs

3. **Phase 3:** Advanced matching
   - Compatibility scoring
   - Multi-field filtering
   - Pace range visualization

---

## Technical Notes

### Pace Format
- Currently stored as strings: "8:00", "9:30", etc.
- For filtering/matching, may need to convert to seconds:
  ```typescript
  function paceToSeconds(pace: string): number {
    const [min, sec] = pace.split(':').map(Number);
    return min * 60 + sec;
  }
  ```

### Performance
- Pace filtering on discovery page should be efficient
- Consider indexing `paceAverage` if used frequently
- Cache compatibility scores if calculated often

---

## Related Files

- **Schema:** `prisma/schema.prisma`
- **Discovery:** `app/runcrew/page.tsx`
- **Domain Logic:** `lib/domain-runcrew.ts`
- **API:** `app/api/runcrew/discover/route.ts`

---

## Notes

- MVP1 keeps pace simple: display attribute only
- Future enhancements depend on user feedback
- 5K pace matching is highest priority for runner pairing
- Pace filtering may not be needed if discovery/search is sufficient

