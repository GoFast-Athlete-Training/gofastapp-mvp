# City Runs - Vision & Architecture

## Overview

City Runs is a publicly discoverable layer for surfacing runs that mirrors the existing RunCrewRun shape and RSVP system. The goal is to lower the barrier to entry - joining a run crew is a huge commitment, but seeing and RSVPing to a public run is lightweight. This serves as proof of concept for larger adoption.

---

## Core Concept

**Unified Model: `city_runs`**
- **One model handles both**:
  - **Public City Runs**: `runCrewId = null` → publicly searchable, anyone can RSVP
  - **Private Crew Runs**: `runCrewId = set` → crew-scoped, requires membership

**RunClub Affiliation**:
- **RunClub** (GoFastCompany) = Official organizations (e.g., "Boston Running Club")
- **RunCrew** (gofastapp-mvp) = App groups (user-created)
- City runs are **legitimate official runs**, often affiliated with RunClubs
- `runClubSlug` (string) references `RunClub.slug` in GoFastCompany
- No FK (cross-repo), but indexed for querying

**Key Design**:
- All runs belong to a `city` (required `cityId`)
- `runCrewId` is nullable - determines if run is public or private
- `runClubSlug` is nullable - tracks official RunClub affiliation
- Backwards compatibility: table name remains `run_crew_runs` via `@@map`
- Model name is `city_runs` (deprecates `run_crew_runs` name)

---

## Architecture Layers

### 1. Public SEO Layer: "DC Runs" (or City-Specific)

**Purpose**: Overall umbrella guide to the city - SEO super searchable

**Location**: Public-facing website (likely gofast-contentpublic or similar)

**Features**:
- City-specific landing pages (e.g., `/dc-runs`, `/boston-runs`)
- SEO-optimized content about running in that city
- Hub for all city-related running content

---

### 2. City Page Hub

**Purpose**: Central hub for all city-related running content

**Features**:
- "See local runs in this city" CTA/link
- When clicked, user steps **inside the app** (gofastapp-mvp)
- Public-facing but transitions to app experience

---

### 3. GoFast Runs (Inside GoFastAthlete App)

**Location**: `gofastapp-mvp` (code name: GoFast Athlete)

**Purpose**: User-facing discovery and RSVP interface

**Features**:
- Searchable run discovery (similar to existing RunCrew discovery)
- Read from `city_runs` table (filter: `runCrewId IS NULL` for public runs)
- Two access patterns:
  - **Public**: Anyone can browse/search runs where `runCrewId IS NULL`
  - **Authenticated**: Left nav bar on athlete home with "Search Runs"
  - **Private**: Crew members see runs where `runCrewId = theirCrewId`

---

### 4. Admin Creation (GoFastCompany)

**Location**: `GoFastCompany` app

**Purpose**: God-view admin interface for creating city runs

**Why**: GoFastCompany has full admin capabilities and can write to any database

**Flow**:
1. Admin creates run on GoFastCompany page
2. Sets `cityId` (required) and `runCrewId` (null for public, set for crew)
3. Saves to `city_runs` table (backwards compatible table name: `run_crew_runs`)
4. GoFastRuns (inside app) reads from same database
5. Public runs (`runCrewId IS NULL`) are searchable by anyone

---

## Data Model

### Models

**`cities`**
- Lightweight reference model
- Fields: `id`, `slug`, `name`, `state`
- Used for GTM and public surfacing
- All runs (public and private) belong to a city

**`city_runs`** (Unified Model)
- **Universal name**: `city_runs` (deprecates `run_crew_runs` model name)
- **Backwards compatibility**: Table name remains `run_crew_runs` via `@@map("run_crew_runs")`
- **Required**: `cityId` (all runs belong to a city)
- **Nullable**: `runCrewId` 
  - `null` = Public city run (searchable, anyone can RSVP)
  - `set` = Private crew run (crew-scoped, requires membership)
- **Nullable**: `runClubSlug` (string reference, not FK)
  - References `RunClub.slug` in GoFastCompany
  - Used for official RunClub affiliation (e.g., "Boston Running Club", "DC Road Runners")
  - These are legitimate official runs, not organic user-generated runs
  - Indexed for querying/filtering
- All standard run fields: `title`, `runType`, `date`, time fields, location fields, recurrence, etc.
- Foreign keys:
  - `cities` (required, cascade delete)
  - `run_crews` (optional, cascade delete - app groups)
  - `Athlete` (creator, cascade delete)
- **String references** (cross-repo):
  - `runClubSlug` → `RunClub.slug` in GoFastCompany (official organizations)

### Key Design Decisions

✅ **Unified model** - One model handles both public and private runs  
✅ **Backwards compatible** - Table name unchanged, model name updated  
✅ **City-first** - All runs belong to a city  
✅ **Privacy via nullable FK** - `runCrewId` determines visibility  
✅ **No duplication** - Shared model, shared info, shared RSVP system  

---

## User Flows

### Flow 1: Public Discovery (Not Logged In)

1. User lands on city SEO page (e.g., "DC Runs")
2. Clicks "See local runs in this city"
3. Redirected to app (gofastapp-mvp) at `/city-runs/[city-slug]`
4. Can browse/search runs
5. Can RSVP (may require lightweight auth or guest RSVP)

### Flow 2: Authenticated User Discovery

1. User logged into GoFastAthlete app
2. Sees "Search Runs" in left nav bar
3. Can browse/search city runs
4. Can RSVP to runs
5. May see "My RSVPs" or similar

### Flow 3: Admin Creation

1. Admin logs into GoFastCompany
2. Navigates to "Create City Run" page
3. Fills out form (mirrors RunCrewRun creation)
4. Saves to `city_runs` table
5. Run immediately visible in GoFastRuns discovery

---

## Implementation Status

### ✅ Completed

- [x] `cities` model created
- [x] `city_runs` unified model created (replaces `run_crew_runs` model name)
- [x] `runCrewId` made nullable in `city_runs`
- [x] `cityId` added as required to `city_runs`
- [x] Backwards compatibility: table name remains `run_crew_runs` via `@@map`
- [x] All relations updated to use `city_runs` model name

### 🚧 Next Steps (Out of Scope for Now)

- [ ] API routes for surfacing city runs
- [ ] RSVP mutations
- [ ] Messaging/notifications
- [ ] Permissions or organizer logic
- [ ] Public SEO pages (DC Runs)
- [ ] City page hub
- [ ] Admin creation interface (GoFastCompany)
- [ ] User-facing discovery interface (GoFastRuns)
- [ ] Search functionality
- [ ] Left nav integration for authenticated users

---

## Design Principles

1. **Unified Model**: One model (`city_runs`) handles both public and private runs
2. **Backwards Compatible**: Table name unchanged, model name updated
3. **City-First**: All runs belong to a city (required `cityId`)
4. **Privacy via Nullable FK**: `runCrewId` determines if run is public or private
5. **Shared Everything**: Same model, same RSVP system, same fields
6. **Public First**: Lower barrier to entry than RunCrew membership
7. **Progressive Enhancement**: Public discovery → Authenticated experience
8. **Admin Separation**: Creation happens in GoFastCompany (god-view)

---

## Questions & Considerations

### Open Questions

- **RSVP Auth**: Do we require login for RSVP, or allow guest RSVP?
- **Run Ownership**: Who can edit/delete runs? (Admin only? Crew admins for crew runs?)
- **Notifications**: How do users get notified about runs they RSVP'd to?
- **Run Conversion**: Can crew runs be made public (set `runCrewId = null`)? Vice versa?
- **Search Scope**: Search by city, date, pace, distance, etc.?
- **Filtering**: How to filter public vs private runs in queries? (`WHERE runCrewId IS NULL`)

### Future Enhancements (Not Now)

- Run organizer permissions
- Messaging between RSVPs
- Run reminders/notifications
- Integration with RunCrew runs (show both?)
- Analytics on RSVP patterns
- Run recommendations based on user profile

---

## File Locations

- **Schema**: `/gofastapp-mvp/prisma/schema.prisma`
- **Models**: `cities`, `city_runs` (table: `run_crew_runs` for backwards compatibility)
- **Admin Creation**: `/GoFastCompany/app/...` (TBD)
- **User Discovery**: `/gofastapp-mvp/app/...` (TBD)
- **Public SEO**: `/gofast-contentpublic/...` or separate (TBD)

---

## Success Metrics

- **Adoption**: Number of RSVPs to city runs
- **Discovery**: Users finding runs via search
- **Conversion**: City run RSVPs → RunCrew memberships
- **Engagement**: Repeat RSVPs, run attendance

---

*Last Updated: [Current Date]*  
*Status: Models Created, API Routes Pending*

