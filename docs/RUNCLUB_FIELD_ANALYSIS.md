# RunClub Field Analysis: Minimal Fields for gofastapp-mvp

## Overview

**Decision**: `AcqRunClub` is the **canonical model** in GoFastCompany.

GoFastCompany has **TWO** RunClub models (temporarily):
1. **`AcqRunClub`** - CRM/acquisition tracking (CANONICAL - source of truth)
2. **`RunClub`** - Public directory (will be merged INTO AcqRunClub)

**For gofastapp-mvp**: We only need **minimal fields** for card/run display:
- `slug` (primary key)
- `name`
- `logoUrl` (or `logo`)
- `city`

All rich data (vibe, neighborhood, description, etc.) stays in GoFastCompany for SEO/public pages.

---

## Model 1: `AcqRunClub` (CRM/Acquisition - DO NOT USE)

**Purpose**: Internal CRM tracking for acquisition targets

**Location**: `GoFastCompany/prisma/schema.prisma` (lines 1785-1818)

### Fields Breakdown:

#### ✅ **Public-Facing** (could be useful):
- `name` - Run club name
- `city` - City location
- `state` - State location
- `logo` - Logo URL
- `description` - Description
- `instagramHandle` - Instagram handle
- `url` - Website URL

#### ❌ **Acquisition/CRM Only** (NOT needed for gofastapp-mvp):
- `id` - Internal UUID
- `companyId` - Company scoping (CRM)
- `demoUrl` - Demo URL for outreach (CRM)
- `membershipEstimate` - Internal estimate (CRM)
- `primaryPurpose` - Internal categorization (CRM)
- `status` - `AcqStatus` (prospect/user) - CRM pipeline
- `runClubPipeline` - `RunClubPipeline` (interest/formal_partnership) - CRM pipeline
- `notes` - Internal notes (CRM)
- `createdAt` / `updatedAt` - Internal timestamps
- Relations: `company`, `leaders` (AcqClubLeader) - CRM relationships

**Verdict**: ❌ **DO NOT USE** - This is CRM/internal tracking only

---

## Model 2: `RunClub` (Public Directory - USE THIS)

**Purpose**: Public-facing directory for SEO and public discovery

**Location**: `GoFastCompany/prisma/schema.prisma` (lines 1861-1902)

### Fields Breakdown:

#### ✅ **Public-Facing** (needed for gofastapp-mvp display):

**Identity** (Essential):
- `slug` - URL-friendly identifier (PRIMARY KEY for reference)
- `name` - Run club name ✅
- `description` - Description ✅
- `logoUrl` - Logo URL ✅ **CRITICAL for display**
- `groupPhotoUrl` - Group photo (optional, nice to have)

**Geography** (Useful for filtering):
- `city` - City location ✅
- `state` - State location ✅
- `neighborhood` - Neighborhood (optional)

**Culture** (Nice to have, but not critical):
- `vibe` - Vibe description (optional)
- `experienceLevel` - `ExperienceLevel` enum (ALL_LEVELS/EXPERIENCED/MIXED)
- `membershipType` - `MembershipType` enum (FREE/PAID)
- `clubType` - `ClubType` enum (SOCIAL/COMPETITIVE/TRAINING/MIXED)
- `socialStructure` - Social structure description (optional)

**External Presence** (Useful for links):
- `websiteUrl` - Website URL ✅
- `instagramHandle` - Instagram handle ✅
- `stravaClubUrl` - Strava club URL ✅

#### ❌ **System/Internal** (NOT needed):
- `id` - Internal UUID (we use `slug` as primary key)
- `isActive` - Active flag (system)
- `createdAt` / `updatedAt` - Timestamps (system)
- Relations: `runs` (RunClubRun[]), `sponsoredRaces` (RunClubRace[]) - Not needed for basic display

---

## Recommended Fields for `run_clubs` in gofastapp-mvp

### Minimal Set (MVP - What We Actually Need):
```prisma
model run_clubs {
  slug            String   @id // Primary key - matches GoFastCompany AcqRunClub.slug
  name            String   ✅ // For card display
  logoUrl         String?  ✅ // For card display (from logoUrl or logo field)
  city            String?  ✅ // For filtering/display
  
  // Sync metadata
  syncedAt        DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Why minimal?**
- Cards/runs only need name, logo, city
- All rich data (vibe, neighborhood, description, etc.) stays in GoFastCompany
- GoFastCompany uses rich data for SEO/public pages
- gofastapp-mvp just needs enough to display affiliation

---

## Decision: What to Pull and Save

### ✅ **Pull from `AcqRunClub` model** (Canonical - after consolidation):
- Use endpoint: `GET /api/runclub-public/by-slug/[slug]` (will use AcqRunClub after consolidation)
- Pull **ONLY minimal fields**:
  - `slug` (primary key)
  - `name` ✅
  - `logoUrl` or `logo` ✅ **CRITICAL for card display**
  - `city` ✅ **For filtering/display**

### ❌ **DO NOT pull**:
- CRM fields: `status`, `runClubPipeline`, `notes`, `companyId`
- Rich public fields: `description`, `vibe`, `neighborhood`, `experienceLevel`, etc.
- External links: `websiteUrl`, `instagramHandle`, `stravaClubUrl`
- **Why?** All this data stays in GoFastCompany for SEO/public pages. gofastapp-mvp only needs enough to display affiliation on cards/runs.

---

## API Endpoint in GoFastCompany

**Endpoint**: `GET /api/runclub-public/by-slug/[slug]` ✅ **CREATED**

**Purpose**: Fetch public RunClub data by slug (no auth required for public directory)

**Returns**: `RunClub` model fields (public directory, not AcqRunClub)

**Use Case**: Called by gofastapp-mvp when hydrating runs with RunClub affiliation

**Location**: `GoFastCompany/app/api/runclub-public/by-slug/[slug]/route.ts`

---

## Summary

**For City Runs affiliation display, we need**:
1. ✅ Pull from `AcqRunClub` (canonical model) after consolidation
2. ✅ **Minimal fields ONLY**: `slug`, `name`, `logoUrl` (or `logo`), `city`
3. ✅ Store in `run_clubs` table in gofastapp-mvp (minimal denormalized copy)
4. ✅ Use `slug` as primary key (matches GoFastCompany `AcqRunClub.slug`)
5. ✅ Track `syncedAt` to know when data was last pulled

**We do NOT need**:
- ❌ Any CRM/acquisition fields (`status`, `pipeline`, `notes`, `demoUrl`, `companyId`)
- ❌ Rich public fields (`description`, `vibe`, `neighborhood`, `experienceLevel`, etc.)
- ❌ External links (`websiteUrl`, `instagramHandle`, `stravaClubUrl`)
- ❌ Internal relations (`company`, `leaders`)
- **Why?** All rich data stays in GoFastCompany for SEO/public pages. gofastapp-mvp only needs enough to display affiliation on cards/runs.

