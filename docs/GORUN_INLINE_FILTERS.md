# GoRun Inline Filters UX

## Flow: Single Page with Inline Filters

**URL**: `/gorun` (single page, stays inline - no navigation to separate city pages)

**Filters** (both inline at top):
1. **By City** (city slug dropdown)
2. **By Day** (day of week dropdown)

---

## Page Structure

```
┌─────────────────────────────────────┐
│  TopNav                             │
├─────────────────────────────────────┤
│  "GoRun"                            │
│                                     │
│  Filters (inline):                  │
│  [City: All Cities ▼] [Day: All Days ▼] │
│                                     │
│  Available Runs:                     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [Logo] Ballston Runaways    │   │
│  │ Saturday Morning Long Run   │   │
│  │ 📅 Sat, Jan 20 at 6:30 AM  │   │
│  │ 📍 Boston - Central Park    │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

## Filter Implementation

### City Filter
- Dropdown/select with all cities that have runs
- Default: "All Cities" (show all)
- On select: Filter runs by `citySlug`

### Day Filter
- Dropdown/select with days of week
- Options: "All Days", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
- On select: Filter runs by day
- For recurring runs: Filter by `dayOfWeek` field
- For single runs: Infer day from `raceDate`/`startDate`

---

## Recurring Runs & Day of Week

### Schema Check
- `isRecurring` (Boolean) - true if recurring
- `dayOfWeek` (String?) - "Monday", "Tuesday", etc. (for recurring runs)
- `startDate` (DateTime) - Start date
- `date` (DateTime) - For single runs

### Day Inference Service

**Created**: `lib/utils/dayOfWeek.ts`

**Functions**:
- `getDayOfWeek(date: Date)` - Get day name from Date
- `getDayOfWeekFromDate(dateInput)` - Get day from string or Date
- `filterRunsByDay(runs, dayFilter)` - Filter runs by day
- `getUniqueDaysFromRuns(runs)` - Get all unique days from runs array

**Logic**:
- **For recurring runs**: Use `dayOfWeek` field directly (already stored)
- **For single runs**: Infer day from `startDate` or `date` field

**Schema Confirmation**:
- ✅ `isRecurring` (Boolean) - true if recurring
- ✅ `dayOfWeek` (String?) - "Monday", "Tuesday", etc. (for recurring runs)
- ✅ `startDate` (DateTime) - For single runs: the run date; for recurring: when recurrence starts
- ✅ `date` (DateTime) - Backward compatibility field

---

## API Endpoint

**GET `/api/runs`** (needs to be created)

**Query Params**:
- `citySlug` (optional) - Filter by city slug
- `day` (optional) - Filter by day of week ("Monday", "Tuesday", etc.)

**Response**:
```json
{
  "success": true,
  "runs": [
    {
      "id": "...",
      "title": "...",
      "citySlug": "boston",
      "isRecurring": true,
      "dayOfWeek": "Saturday", // For recurring runs
      "startDate": "...", // For recurring: when recurrence starts; for single: run date
      "date": "...", // Backward compatibility
      "runClubSlug": "ballston-runaways",
      "runClub": { ... }, // Hydrated (lazy)
      "meetUpPoint": "...",
      "startTimeHour": 6,
      "startTimeMinute": 30,
      "startTimePeriod": "AM",
      ...
    }
  ]
}
```

**Filtering Logic** (server-side):
- If `citySlug` provided: `WHERE citySlug = ?`
- If `day` provided:
  - For recurring: `WHERE isRecurring = true AND dayOfWeek = ?`
  - For single: `WHERE isRecurring = false AND EXTRACT(DOW FROM startDate) = ?` (0=Sunday, 1=Monday, etc.)

---

## Implementation Notes

1. ✅ **Single page** - `/gorun` stays inline (no navigation to `/gorun/[citySlug]`)
2. ✅ **Inline filters** - Both filters (city + day) visible at top of page
3. ✅ **Day inference service** - `lib/utils/dayOfWeek.ts` created
4. ✅ **Recurring runs** - Use `dayOfWeek` field directly (already stored)
5. ✅ **Single runs** - Infer day from `startDate`/`date` using service function
6. ✅ **Schema confirmed** - `dayOfWeek` field exists and is indexed for recurring runs

