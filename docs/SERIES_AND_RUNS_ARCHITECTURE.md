# Series & Runs Architecture

The mental model, schema decisions, and downstream UX flows for how recurring series and individual runs relate.

---

## Core principle: a run doesn't know what it is

A `city_run` never asks "am I a series run or a standalone?" It's just a run — a specific event on a specific date.

The **parent relationship** answers the question:

```
city_runs.cityRunSetupId = null      → standalone (no parent, one-off event)
city_runs.cityRunSetupId = "abc123"  → series occurrence (parent is city_run_setups)
```

There is no `instanceType` enum. The FK presence IS the type. This means:
- No toggle anywhere that asks "series or standalone?"
- No dual-write to keep in sync
- Filtering is just `WHERE cityRunSetupId IS NOT NULL` vs `IS NULL`

---

## Schema

```
city_run_setups (the series)
  id
  dayOfWeek         — "TUESDAY", "SATURDAY", etc. (canonical)
  runClubId         — which club owns this
  name              — e.g. "Tuesday Tempo"
  description       — series blurb (seeds each occurrence's description)
  gofastCity        — city slug, same every week
  meetUpPoint       — the corner / park / landmark, same every week
  meetUpStreetAddress, meetUpCity, meetUpState
  meetUpPlaceId, meetUpLat, meetUpLng
  startTimeHour, startTimeMinute, startTimePeriod  — same every week
  startDate, endDate — optional: when this series runs

city_runs (an occurrence)
  id
  title             — e.g. "Tuesday Tempo – Mar 4"  (seeded from setup name + date)
  date              — specific occurrence date (the only date field on a run)
  dayOfWeek         — canonical, seeded from setup
  cityRunSetupId    — null = standalone; set = series occurrence
  gofastCity, meetUpPoint, etc.  — seeded from setup, can be overridden per occurrence
  description       — seeded from setup, VA can refine per occurrence
  workflowStatus    — DEVELOP → PENDING → APPROVED → PUBLISHED
  runClubId         — FK to run_clubs
```

---

## Data flow: runSchedule → series → run

```
acq_run_clubs.runSchedule (string)
        │
        ▼
parseRunSchedule() → RunScheduleEntry[]
        │
        └── entry without URL → "Set up this series"
                │
                ▼
        city_run_setups created (or found if already exists for club+day)
                │
                ▼
        city_run seeded from setup
        (title = "Series Name – Date", location/time/description inherited)
                │
                ▼
        run URL written back into runSchedule string
        entry now shows "View run" instead of "Set up this series"
```

---

## Downstream UX (gofastapp-mvp — future build)

### 1. Club onboarding flow

```
"Do you have any standing runs?"
├── Yes → Series setup
│         form: name, day, location, time, description
│         creates: city_run_setups
│         then: "Ready to launch your first actual run?"
│               → most fields pre-filled from series
│               → optional: add this week's specific route
│               → creates: city_run linked to setup
│
└── No → "Just a run?" → CreateRun form (no series)
          creates: city_run with cityRunSetupId = null
```

### 2. Edge case: standalone run that wants to graduate

```
User creates a run (cityRunSetupId = null)
  ↓
Later: "Make this a series?"
  ↓
Series setup form with REVERSE INFERENCE
  (prefills series fields from the existing run's location/time/description)
  ↓
On save:
  1. Creates city_run_setups with inferred data
  2. Updates existing city_run: SET cityRunSetupId = new setup id
  3. Run is now a series occurrence — no duplicate created
```

### 3. Public run page: /gorun/[runId]

```
┌─────────────────────────────┬──────────────────────────┐
│  Run details (left)         │  Series panel (right)    │
│                             │  only if cityRunSetupId  │
│  - Title                    │  is set                  │
│  - Date                     │                          │
│  - Location / map           │  "Part of: Tuesday Tempo"│
│  - Distance / pace          │  Every Tuesday · 6:30 AM │
│  - Description              │  Union Market, DC        │
│  - RSVP / checkin           │  [series description]    │
│                             │  Hosted by [club logo]   │
└─────────────────────────────┴──────────────────────────┘
```

Layout is single-column for standalone runs, two-column when part of a series.

### 4. Series membership + auto-RSVP (future)

```
series_memberships table
  id
  seriesId    → FK to city_run_setups
  athleteId   → FK to athletes
  joinedAt

Flow:
  Athlete RSVPs for "all runs in this series"
    → creates series_memberships record
    → service trigger: on each new city_run created under this series,
      auto-create city_run_rsvps for all active series_memberships
      (status: 'going', source: 'series_auto')

Result: join the series once, automatically going to every occurrence.
```

---

## What belongs where

| Field | city_run_setups (series) | city_runs (occurrence) |
|-------|--------------------------|------------------------|
| Day of week | Source of truth | Seeded from setup |
| Location (meetUpPoint etc.) | Universal — same corner every week | Seeded, can override if one-off location |
| Start time | Universal | Seeded, can override |
| Series description | Template | Seeded; VA refines per occurrence |
| Route (specific) | — | Occurrence-only (this week's actual route) |
| Date | — | Occurrence-only |
| Title | Series name | "Series Name – Date" |
| workflowStatus | — | Occurrence-only (DEVELOP → PUBLISHED) |

---

## Query patterns

```typescript
// Is this run part of a series?
const isSeries = run.cityRunSetupId != null;

// All series runs for a club
prisma.city_runs.findMany({ where: { runClubId, cityRunSetupId: { not: null } } })

// All standalone runs
prisma.city_runs.findMany({ where: { cityRunSetupId: null } })

// All runs in a specific series
prisma.city_runs.findMany({ where: { cityRunSetupId: setupId }, orderBy: { date: 'asc' } })

// Next occurrence of a series
prisma.city_runs.findFirst({
  where: { cityRunSetupId: setupId, date: { gte: new Date() } },
  orderBy: { date: 'asc' }
})
```

---

## Implementation order

1. **Schema** — `city_run_setups` fields + drop `instanceType` ✅ done
2. **Admin (GoFastCompany)** — runSchedule → CreateSeriesAndRunModal → series + first run ✅ done
3. **Public container** — series panel on `/gorun/[runId]` when FK set ✅ done
4. **Club onboarding** — series setup page in gofastapp-mvp (future)
5. **Reverse inference** — standalone → attach to series (future)
6. **Series memberships** — auto-RSVP on series join (future)
