# GoRun Flow - Holistic Overview

**Date:** 2025-01-XX  
**Status:** MVP1 - Authenticated Only

---

## 🎯 Flow Overview

### 1. Run Creation

**Two Entry Points:**

#### A. GoFastCompany Admin Creates Run
```
GoFastCompany Admin Dashboard
  ↓
Select RunClub from dropdown
  ↓
Auto-save RunClub to gofastapp-mvp (POST /api/runclub/save)
  ↓
Create Run (POST /api/runs/create)
  - Includes runClub object (id, slug, name, logoUrl, city)
  - Saves runClub to run_clubs table (dual save)
  - Saves run to city_runs table
  ↓
Run Created ✅
```

#### B. User Creates Run in App (Future)
```
gofastapp-mvp User
  ↓
Create Run Form
  ↓
POST /api/runs/create
  - Can include runClubSlug or runCrewId
  ↓
Run Created ✅
```

---

### 2. Hydration (Inside gofastapp-mvp - Authenticated)

**When:** On run detail page load (`/gorun/[runId]`)

```
User clicks run card
  ↓
GET /api/runs/[runId]
  ↓
Server fetches run from city_runs table
  ↓
IF runClubSlug exists:
  - Check run_clubs table (local)
  - IF missing → Fetch from GoFastCompany API
  - Save to run_clubs table (for next time)
  - Attach runClub object to run
  ↓
IF runCrewId exists:
  - Fetch from run_crews table (local)
  - Attach runCrew object to run
  ↓
Include RSVPs with athlete data
  ↓
Return run with runClub/runCrew + rsvps
```

**Key Point:** Hydration happens on-demand (detail page only), not on list view (avoids collisions)

---

### 3. Cards Page (`/gorun`)

**What Shows:**
- **Card Display:**
  - Run Name (title)
  - Mileage (totalMiles)
  - Pace
  - City (from citySlug or meetUpCity)
  - Date/Time (formatted)
  - Location (meetUpPoint)
- **NO RunClub/RunCrew display** (simpler, no collisions)
- **Clickable** → Navigate to detail page

**Filtering:**
- City dropdown (from available cities)
- Day dropdown (from available days)

**API:** `GET /api/runs?citySlug=boston&day=Monday`
- Returns runs only (no RunClub hydration)
- Fast, single query

---

### 4. Card Detail (`/gorun/[runId]`)

**What Shows:**

#### Header Section
- **RunClub Header** (if runClubSlug exists)
  - Logo (if available)
  - Name
  - City
- **RunCrew Header** (if runCrewId exists)
  - Logo (if available)
  - Name
  - Link to RunCrew

#### Run Details
- **Title** (large, prominent)
- **Date & Time**
  - Recurring: "Every Monday" + start date
  - Single: Full date (e.g., "Monday, January 15, 2025")
  - Start time (e.g., "6:30 AM")
- **Location**
  - Meet-up point name
  - Full address (street, city, state, zip)
  - "Open in Maps" link (if lat/lng available)
- **Run Details**
  - Distance (miles)
  - Pace
- **Description** (if available)
- **Strava Route** link (if available)

#### RSVPs Section
- **People Going**
  - Count: "Going (X)"
  - List with avatars/photos
  - Names
- **Your RSVP**
  - "Going" button (green when selected)
  - "Not Going" button (red when selected)

---

## 🔄 Data Flow

```
Run Created
  ↓
Saved to city_runs table
  ↓
List View (/gorun)
  - Fetches runs (no hydration)
  - Shows cards with basic info
  ↓
User clicks card
  ↓
Detail View (/gorun/[runId])
  - Fetches run + hydrates RunClub/RunCrew
  - Shows full details + RSVPs
```

---

## 📊 Database Schema

### city_runs
- Stores all runs (public city runs + private crew runs)
- Fields: title, citySlug, runClubSlug, runCrewId, date/time, location, etc.

### run_clubs
- Minimal denormalized copy of GoFastCompany AcqRunClub
- Fields: slug (PK), name, logoUrl, city
- Synced on run creation (dual save) or on-demand (detail page)

### run_crew_run_rsvps
- RSVPs for runs (works for both city_runs and crew runs)
- Fields: runId, athleteId, status ('going' | 'not-going')
- Unique: (runId, athleteId)

---

## 🎨 Card Design Spec

### List Card (`/gorun`)
```
┌─────────────────────────────┐
│ [Run Name]                  │
│                             │
│ 📍 [Location Name]          │
│ 🏃 [Miles] miles • [Pace]   │
│ 📅 [Date] • [Time]          │
│ 🏙️ [City]                   │
│                             │
│ [View Details Button]       │
└─────────────────────────────┘
```

### Detail Card (`/gorun/[runId]`)
```
┌─────────────────────────────┐
│ [RunClub Logo] [RunClub]    │ ← If RunClub
│                             │
│ [Run Name]                  │
│                             │
│ 📅 [Full Date]              │
│ ⏰ [Start Time]             │
│ 📍 [Location]               │
│    [Full Address]           │
│    [Open in Maps]           │
│                             │
│ 🏃 [Miles] miles            │
│ ⚡ Pace: [Pace]             │
│                             │
│ [Description]               │
│                             │
│ ─────────────────────────── │
│ People Going (X)            │
│ [Avatar] Name               │
│ [Avatar] Name               │
│                             │
│ Your RSVP:                  │
│ [Going] [Not Going]         │
└─────────────────────────────┘
```

---

## 🔐 Authentication

**Current:** All endpoints require Firebase Bearer token
- List view: Authenticated only
- Detail view: Authenticated only
- RSVP: Authenticated only

**Future:** Public discovery will be handled by `gofast-contentpublic` (separate app)

---

## ✅ MVP1 Scope

- ✅ Run creation (GoFastCompany admin)
- ✅ Run list with filtering (city, day)
- ✅ Run detail page
- ✅ RunClub/RunCrew display on detail
- ✅ RSVP functionality
- ✅ "People Going" list
- ✅ Card design (name, mileage, pace, city)

**Not in MVP1:**
- Public routes (handled by gofast-contentpublic)
- User-created runs (future)
- Advanced filtering
- Run editing/deletion

