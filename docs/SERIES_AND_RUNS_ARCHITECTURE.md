# Series & Runs Architecture

The mental model, schema decisions, and downstream UX flows for how recurring series and individual runs relate.

---

## Core principle: a run doesn't know what it is

A `city_run` never asks "am I a series run or a standalone?" It's just a run — a specific event on a specific date.

The **parent relationship** answers the question:

```
city_runs.runSeriesId = null      → standalone (no parent, one-off event)
city_runs.runSeriesId = "abc123"  → series occurrence (parent is run_series)
```

There is no `instanceType` enum. The FK presence IS the type. This means:
- No toggle anywhere that asks "series or standalone?"
- No dual-write to keep in sync
- Filtering is just `WHERE runSeriesId IS NOT NULL` vs `IS NULL`

---

## Schema

```
run_series (the series template)
  id
  slug              — URL-friendly e.g. "dc-run-crew-tuesday"
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
  workflowStatus    — RunWorkflowStatus: DEVELOP → PENDING → SUBMITTED → APPROVED

city_runs (one specific event)
  id
  slug
  runSeriesId       — FK to run_series; null = standalone
  runClubId
  date              — the actual run date (single field, not startDate/endDate)
  workflowStatus    — RunWorkflowStatus: DEVELOP → PENDING → SUBMITTED → APPROVED
  title, description
  meetUpPoint, meetUpStreetAddress, ...  (seeded from run_series, can override)
  startTimeHour, startTimeMinute, startTimePeriod
```

---

## Workflow status (same 4-stage enum on both models)

```
DEVELOP   → founder just created / seeded; nobody working on it yet
PENDING   → assigned to VA cue; VA is actively developing it
SUBMITTED → VA submitted for founder approval
APPROVED  → live / published
```

For `run_series`: the series itself moves through this pipeline independently of its individual `city_runs`.  
For `city_runs`: each occurrence has its own status.

---

## Public link architecture (IMPORTANT — next build)

> **This is the key unlock that changes how "See details" works.**

### Old assumption (wrong)
Club page → "See details" → `/gorun/[runId]` → RSVP

This assumed the primary entry point was always an individual run. That breaks down when the series is the persistent thing and individual runs are derived.

### Correct model (series-first)

```
Public club page
  └── recurring slot (e.g. "Every Tuesday 7pm")
       └── "See details" → /series/[series.slug]   ← PUBLIC SERIES CONTAINER (next build)
            ├── Series info (day, time, location, description)
            ├── "Next run in this series" card
            │     └── date + "RSVP for this run" → /gorun/[runId]
            └── "RSVP for all runs in this series"
                  └── creates series_membership → auto-RSVP on each new city_run
```

### Why this matters for the codebase

1. **"See details" from club page** will link to `/series/[slug]` not `/gorun/[runId]`.  
   The series is the stable, persistent entity. Individual runs come and go.

2. **`/series/[slug]` public container** (to build) needs:
   - `run_series` data (day, time, location, name, description)
   - Next upcoming `city_run` where `runSeriesId = series.id AND date >= today`
   - All upcoming occurrences list
   - RSVP entry points at both the series level and per-run level

3. **`/gorun/[runId]` public container** (exists) should show:
   - Left: run-specific details (this specific date, route, etc.)
   - Right: "Part of [Series Name]" → links to `/series/[slug]`

4. **The link is NOT as simple as "here's your run URL"** — the primary shareable/linkable thing for a recurring run club is the series page, not a specific run date.

---

## Series memberships (future — auto-RSVP)

```
series_memberships
  id
  userId
  runSeriesId
  status: 'active' | 'paused' | 'cancelled'
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

| Field | run_series | city_runs (occurrence) |
|-------|------------|------------------------|
| Day of week | Source of truth | Seeded from series |
| Location (meetUpPoint etc.) | Universal — same corner every week | Seeded, can override if one-off |
| Start time | Universal | Seeded, can override |
| Series description | Template | Seeded; VA refines per occurrence |
| Route (specific) | — | Occurrence-only |
| Date | — | Occurrence-only |
| Title | Series name | "Series Name – Date" |
| workflowStatus | Series pipeline | Occurrence pipeline (independent) |
| slug | Series-level URL | Run-level URL |

---

## Query patterns

```typescript
// Is this run part of a series?
const isSeries = run.runSeriesId != null;

// All series runs for a club
prisma.city_runs.findMany({ where: { runClubId, runSeriesId: { not: null } } })

// All standalone runs
prisma.city_runs.findMany({ where: { runSeriesId: null } })

// All runs in a specific series
prisma.city_runs.findMany({ where: { runSeriesId: seriesId }, orderBy: { date: 'asc' } })

// Next occurrence of a series (for the series public container card)
prisma.city_runs.findFirst({
  where: { runSeriesId: seriesId, date: { gte: new Date() } },
  orderBy: { date: 'asc' }
})
```

---

## Implementation status

1. **Schema** — `run_series` (renamed from `city_run_setups`), `runSeriesId` FK, `RunWorkflowStatus` on both models ✅
2. **Admin seeding (GoFastCompany)** — runSchedule → schedule page → CreateSeriesAndRunModal → `run_series` stub (DEVELOP) ✅
3. **Admin workflow** — Develop → Run Series → Assign (PENDING) for VA cue ✅
4. **Public run container** — series panel on `/gorun/[runId]` when FK set ✅
5. **Public series container** — `/series/[slug]` with next-run card + RSVP entry points ⬜ next build
6. **Club page "See details" link** — update to point to `/series/[slug]` ⬜ next build
7. **Reverse inference** — standalone run → attach to existing series ⬜ future
8. **Series memberships** — auto-RSVP on series join ⬜ future
