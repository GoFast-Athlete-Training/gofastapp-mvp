# GoRun UX Flow

## Core Flow

```
gorun (single page with inline filters) → available runs
```

**Filters**:
- By City (city slug)
- By Day (day of week)

---

## Step-by-Step User Journey

### Step 1: Navigation → `/gorun`

**User Action**: Clicks "GoRun" in TopNav

**Page**: `/gorun` (Single Page - Stays Inline)

**Content**:
- Hero: "Ready to go run? Select your city and see what's happening"
- **Inline Filters**:
  - City filter (dropdown): "All Cities" | "Boston" | "New York" | etc.
  - Day filter (dropdown): "All Days" | "Monday" | "Tuesday" | etc.
- **Available runs** displayed as cards (filtered by selections)
- Each card shows:
  - RunClub logo + name (if affiliated)
  - Run title
  - Date & time
  - Location (meet up point)
  - RSVP button (if logged in)

**User Actions**:
- Select city → Filters runs by city slug
- Select day → Filters runs by day of week
- View runs → Can RSVP or view details

---

## Page Structure

### `/gorun` (Single Page with Inline Filters)

```
┌─────────────────────────────────────┐
│  TopNav (with GoRun highlighted)    │
├─────────────────────────────────────┤
│                                     │
│  "Ready to go run?                  │
│   Select your city and see          │
│   what's happening"                 │
│                                     │
│  Filters:                            │
│  [City: All Cities ▼] [Day: All Days ▼] │
│                                     │
│  Available Runs:                     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [Logo] Ballston Runaways    │   │
│  │ Hosted by Ballston Runaways  │   │
│  │                              │   │
│  │ Saturday Morning Long Run    │   │
│  │                              │   │
│  │ 📅 Sat, Jan 20 at 6:30 AM   │   │
│  │ 📍 Boston - Central Park    │   │
│  │                              │   │
│  │ [RSVP] [View Details]        │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Tuesday Evening Tempo Run   │   │
│  │ 📅 Tue, Jan 22 at 6:00 PM  │   │
│  │ 📍 Boston - Memorial Park  │   │
│  │ [RSVP] [View Details]        │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

## Data Flow

### Single Page (`/gorun`)
- **API**: `GET /api/runs?citySlug=boston&day=Saturday` (query params)
- **Returns**: Filtered runs based on city and day
- **Hydration**: RunClub data pulled and saved (lazy)
- **Display**: Run cards with RunClub affiliation

**Filter Logic**:
- City filter: Filter by `citySlug` (server-side or client-side)
- Day filter: 
  - Recurring runs: Filter by `dayOfWeek` field
  - Single runs: Infer day from `startDate`/`date` using `getDayOfWeek()` utility

---

## Key UX Decisions

1. ✅ **Single page with inline filters** (stays on `/gorun`)
   - Simpler UX - no navigation needed
   - Filters update results instantly
   - Can combine filters (city + day)

2. ✅ **Two inline filters**
   - City filter: Dropdown with all cities
   - Day filter: Dropdown with days of week
   - Both visible at top, easy to change

3. ✅ **Day inference service**
   - Recurring runs: Use `dayOfWeek` field (already stored)
   - Single runs: Infer from `startDate`/`date` using utility function
   - Service created: `lib/utils/dayOfWeek.ts`

4. ✅ **"Available runs"** language
   - Clear what user is seeing
   - Implies there might be more (future: additional filters)

5. ✅ **RunClub affiliation prominent**
   - Logo + name at top of card
   - Builds trust/recognition
   - Shows official affiliation

---

## Future Enhancements

- Filter by date range
- Filter by distance/pace
- Filter by RunClub
- Map view
- Calendar view
- Recurring run indicators

---

## Implementation Status

- [x] Navigation item "GoRun"
- [x] Day inference service (`lib/utils/dayOfWeek.ts`)
- [x] Schema confirmed (`dayOfWeek` field exists for recurring runs)
- [ ] Single page (`/gorun`) with inline filters
- [ ] API endpoint (`GET /api/runs` with query params)
- [ ] RunClub hydration
- [ ] Run cards display
- [ ] Filter logic (city + day)

