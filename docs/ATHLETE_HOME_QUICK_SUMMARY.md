# Athlete Home Migration - Quick Summary

## 📊 Component Comparison

### Old App Features (436 lines) vs New App (174 lines)

| Feature | Old App | New App | Status |
|---------|---------|---------|--------|
| **Header** | ✅ Logo + Profile + Settings + Sign Out | ❌ None | **MISSING** |
| **Hero Run Crew Section** | ✅ Gradient card with next run, attendees | ❌ Basic card grid | **MISSING** |
| **Weekly Stats Card** | ✅ Miles, Activities, Calories | ❌ None | **MISSING** |
| **Garmin Connection Prompt** | ✅ Conditional display | ❌ None | **MISSING** |
| **Latest Activity Card** | ✅ Clickable micro card | ❌ None | **MISSING** |
| **RSVP CTA** | ✅ Prompts for upcoming runs | ❌ None | **MISSING** |
| **Basic Layout** | ✅ Full dashboard | ⚠️ Basic grid only | **PARTIAL** |

---

## 🔧 Critical Dependencies Missing

### 1. Hooks (Need to Create)
- ❌ `useHydratedAthlete` - Reads athlete/crew from localStorage
- ❌ `useActivities` - Fetches/manages weekly activities

### 2. Utilities (Need to Create)
- ❌ `formatPace()` - Formats pace as min:sec/mi
- ❌ `formatDistance()` - Converts meters to miles

### 3. localStorage API Methods (Need to Add)
- ❌ `getRunCrewData()` - Get full crew object
- ❌ `getMyCrew()` - Get primary crew ID (V2 key)
- ❌ `getMyCrewManagerId()` - Get manager ID (V2 key)

### 4. NPM Packages (Need to Install)
- ❌ `lucide-react` - For icons (Activity, Users, Settings, Calendar, Clock, MapPin)

---

## 📋 Key Features Breakdown

### ✅ Hero Run Crew Section (Priority: HIGH)
**What it shows:**
- Crew name, description, icon
- Next upcoming run with date/time
- Meet up location
- First 3 attendee avatars
- "View Crew" button

**What's needed:**
- Crew data from localStorage or API
- Next run calculation (filter + sort upcoming runs)
- RSVP data parsing
- Gradient styling

### ✅ Weekly Stats Card (Priority: HIGH)
**What it shows:**
- Total miles (formatted)
- Activity count
- Total calories
- "View All Activities" link

**What's needed:**
- `useActivities` hook
- `weeklyTotals` object
- Conditional on Garmin connection

### ✅ Garmin Connection Prompt (Priority: MEDIUM)
**What it shows:**
- Orange border card
- Activity icon
- Connection prompt text
- "Connect →" button

**What's needed:**
- API call to `/garmin/status?athleteId=${athleteId}`
- Conditional rendering logic

### ✅ Latest Activity Card (Priority: MEDIUM)
**What it shows:**
- Activity icon
- Distance and pace
- Date/time
- Clickable to activity detail

**What's needed:**
- Latest activity from weeklyActivities
- `formatPace()` helper
- `formatDistance()` helper
- Navigation to `/activities/[id]`

### ✅ RSVP CTA Card (Priority: LOW)
**What it shows:**
- Orange-themed card
- "RSVP now" message
- Run date
- RSVP button

**What's needed:**
- Conditional on crew + nextRun existing
- Navigation to crew page

---

## 🚨 Critical Migration Issues

### 1. localStorage API Incompatibility
**Problem**: New app's `localstorage.ts` is missing several methods used by old app

**Missing Methods:**
```typescript
getRunCrewData()        // Get full crew object
getMyCrew()             // V2 primary crew ID
getMyCrewManagerId()    // V2 manager ID
```

**Solution**: Add these methods to `lib/localstorage.ts`

---

### 2. No Custom Hooks
**Problem**: Old app relies heavily on custom hooks that don't exist in new app

**Required Hooks:**
- `useHydratedAthlete` - Must read from localStorage (not API)
- `useActivities` - Must handle localStorage cache + API fallback

**Solution**: Create `app/hooks/` directory and implement hooks

---

### 3. Icon Library Missing
**Problem**: Old app uses Lucide React icons extensively

**Required Icons:**
- `Activity`, `Users`, `Settings`, `Calendar`, `Clock`, `MapPin`

**Solution**: `npm install lucide-react`

---

## 📍 Route Mapping

| Old App Route | New App Route | Status |
|---------------|---------------|--------|
| `/athlete-profile` | `/profile` | ✅ Exists |
| `/settings` | `/settings` | ✅ Exists |
| `/runcrew/join-or-start` | `/runcrew` | ⚠️ Needs verification |
| `/runcrew/central` | `/runcrew/[id]` | ✅ Exists |
| `/crew/crewadmin` | `/runcrew/[id]/admin` | ✅ Exists |
| `/my-activities` | `/activities` | ✅ Exists |
| `/activity/:id` | `/activities/[id]` | ✅ Exists |

---

## 🎯 Recommended Migration Order

### Phase 1: Foundation (1-2 hours)
1. Install `lucide-react`
2. Create `app/hooks/` directory
3. Implement `useHydratedAthlete` hook
4. Implement `useActivities` hook
5. Add missing localStorage methods

### Phase 2: Core UI (2-3 hours)
1. Build header component
2. Build hero Run Crew section
3. Build weekly stats card
4. Add helper functions (formatPace, formatDistance)

### Phase 3: Features (1-2 hours)
1. Add Garmin connection check
2. Build Garmin connection prompt
3. Build latest activity card
4. Build RSVP CTA card

### Phase 4: Integration (1 hour)
1. Add "RunCrew or Bust" redirect
2. Wire up all navigation
3. Test all flows

**Total Estimated Time**: 5-8 hours

---

## 🔍 Quick Reference

**Old App File**: `gofastfrontend-mvp1/src/Pages/Athlete/AthleteHome.jsx`  
**New App File**: `gofastapp-mvp/app/athlete-home/page.tsx`  
**Inspection Doc**: `docs/ATHLETE_HOME_MIGRATION_INSPECTION.md`

---

**Next Step**: Start with Phase 1 - Create hooks and update localStorage API

