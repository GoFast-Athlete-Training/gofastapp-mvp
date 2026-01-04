# MVP1 vs MVP2 Roadmap

**Date**: January 2025  
**Purpose**: Document what's complete in MVP1 and what's planned for MVP2

---

## MVP1: Current Status ✅

### ✅ **Complete Features**

#### Authentication & Onboarding
- ✅ Splash page
- ✅ Sign up / Sign in
- ✅ Profile creation
- ✅ Profile editing
- ✅ Welcome page (hydration)

#### Profile Management
- ✅ Profile display page
- ✅ Profile edit page
- ✅ Profile settings (minimal)
- ✅ Profile photo upload

#### RunCrew Core Features
- ✅ Create RunCrew
- ✅ Join RunCrew (by code/URL)
- ✅ RunCrew home page
- ✅ Member view
- ✅ Admin view
- ✅ RunCrew settings (basic)
- ✅ Announcements (create/view)
- ✅ Messages (topic-based chat)
- ✅ Runs (create/view/RSVP)
- ✅ Member list
- ✅ Invite links & join codes
- ✅ Message topics management

#### Navigation & UI
- ✅ Top navigation bar with profile picture
- ✅ Responsive design
- ✅ Mobile-friendly layouts

---

## MVP2: Planned Features 🚀

### 🔴 **High Priority**

#### 1. Activities System
**Status**: ❌ Not Started  
**Priority**: High

**Features:**
- Activity list page (`/activities`)
- Activity detail page (`/activities/[id]`)
- Activity sync from Garmin
- Activity statistics
- Weekly activity totals
- Activity filtering and search

**Pages Needed:**
- `/activities` - List all activities
- `/activities/[id]` - Activity detail view

**API Routes Needed:**
- `GET /api/activities` - List activities
- `GET /api/activities/[id]` - Get activity detail
- `POST /api/garmin/sync` - Sync activities from Garmin
- `GET /api/activities/stats` - Get activity statistics

**Components Needed:**
- `ActivityCard` - Display activity summary
- `ActivityDetail` - Full activity view
- `ActivityStats` - Statistics display
- `ActivityFilters` - Filter/search activities

**Estimated Time**: 1-2 weeks

---

#### 2. Events System
**Status**: ❌ Not Started  
**Priority**: High

**Features:**
- Create events (separate from runs)
- Event calendar view
- Event RSVP system
- Event management (admin)
- Event notifications

**Pages Needed:**
- `/runcrew/[runCrewId]/events` - Event list
- `/runcrew/[runCrewId]/events/[eventId]` - Event detail
- `/runcrew/[runCrewId]/events/create` - Create event (admin)
- `/settings/events` - Event management settings

**API Routes Needed:**
- `GET /api/runcrew/[id]/events` - List events
- `POST /api/runcrew/[id]/events` - Create event
- `GET /api/runcrew/[id]/events/[eventId]` - Get event detail
- `PUT /api/runcrew/[id]/events/[eventId]` - Update event
- `DELETE /api/runcrew/[id]/events/[eventId]` - Delete event
- `POST /api/runcrew/[id]/events/[eventId]/rsvp` - RSVP to event

**Components Needed:**
- `EventCard` - Display event summary
- `EventDetail` - Full event view
- `EventCalendar` - Calendar view
- `EventForm` - Create/edit event form
- `EventRSVPButton` - RSVP functionality

**Database Schema:**
- ✅ `RunCrewEvent` table exists
- ✅ `RunCrewEventRSVP` table exists

**Estimated Time**: 1-2 weeks

---

#### 3. RunCrew Leaderboard
**Status**: ❌ Not Started  
**Priority**: High

**Features:**
- Leaderboard display (miles, activities, etc.)
- Weekly/monthly/all-time rankings
- Member rankings
- Achievement badges
- Stats comparison

**Pages Needed:**
- `/runcrew/[runCrewId]/leaderboard` - Leaderboard view

**API Routes Needed:**
- `GET /api/runcrew/[id]/leaderboard` - Get leaderboard data
- `GET /api/runcrew/[id]/leaderboard/stats` - Get aggregated stats

**Components Needed:**
- `LeaderboardTable` - Display rankings
- `LeaderboardCard` - Member ranking card
- `StatsComparison` - Compare stats
- `AchievementBadge` - Display badges

**Estimated Time**: 1 week

---

### 🟡 **Medium Priority**

#### 4. Enhanced Run Detail Page
**Status**: ❌ Not Started  
**Priority**: Medium

**Features:**
- Full run detail view
- RSVP list with avatars
- Run map/route display
- Run comments/discussion
- Run edit/delete (admin)

**Pages Needed:**
- `/runcrew/[runCrewId]/runs/[runId]` - Run detail page

**API Routes Needed:**
- `GET /api/runcrew/[id]/runs/[runId]` - Get run detail
- `PUT /api/runcrew/[id]/runs/[runId]` - Update run
- `DELETE /api/runcrew/[id]/runs/[runId]` - Delete run
- `GET /api/runcrew/[id]/runs/[runId]/rsvps` - Get RSVP list

**Components Needed:**
- `RunDetail` - Full run view
- `RSVPList` - List of RSVPs
- `RunMap` - Map/route display
- `RunComments` - Comments section

**Estimated Time**: 3-5 days

---

#### 5. Enhanced Profile Settings
**Status**: ⚠️ Basic version exists  
**Priority**: Medium

**Features:**
- Notification preferences
- Privacy settings
- Display preferences
- Account management
- Connected devices (Garmin, etc.)

**Pages Needed:**
- Enhanced `/settings` page with tabs

**Estimated Time**: 3-5 days

---

### 🟢 **Low Priority**

#### 6. Volunteer Management
**Status**: ❌ Not Started  
**Priority**: Low

**Features:**
- Volunteer signup
- Volunteer management
- Vacant volunteer positions

**Estimated Time**: 1 week

---

#### 7. Google Places Integration
**Status**: ❌ Not Started  
**Priority**: Low

**Features:**
- Location autocomplete
- Map integration
- Place search

**Estimated Time**: 2-3 days

---

#### 8. Strava Route Preview
**Status**: ❌ Not Started  
**Priority**: Low

**Features:**
- Route visualization
- Strava integration

**Estimated Time**: 2-3 days

---

## Implementation Timeline

### Phase 1: MVP2 Core Features (4-6 weeks)
1. **Activities System** (1-2 weeks)
2. **Events System** (1-2 weeks)
3. **RunCrew Leaderboard** (1 week)
4. **Run Detail Page** (3-5 days)

### Phase 2: Enhancements (2-3 weeks)
5. Enhanced Profile Settings
6. Volunteer Management
7. Google Places Integration
8. Strava Route Preview

---

## Technical Notes

### Activities System
- Will integrate with Garmin webhook system
- Need to sync activities from Garmin Connect
- Display activity data (distance, pace, duration, etc.)
- Calculate weekly/monthly totals

### Events System
- Separate from runs (social events, meetups, etc.)
- Calendar view for upcoming events
- RSVP system similar to runs
- Event types: happy-hour, social, meetup, etc.

### Leaderboard
- Aggregate activity data per member
- Calculate rankings (miles, activities, consistency)
- Time periods: weekly, monthly, all-time
- Achievement system (badges, milestones)

---

## Database Schema Status

### ✅ Already Exists
- `RunCrewEvent` - Events table
- `RunCrewEventRSVP` - Event RSVPs
- `AthleteActivity` - Activities table (if exists)
- `RunCrewRun` - Runs table
- `RunCrewRunRSVP` - Run RSVPs

### ❌ May Need
- Leaderboard aggregation tables (or compute on-the-fly)
- Achievement/badge system tables
- Activity statistics cache tables

---

## API Endpoints Status

### ✅ Already Exists
- `/api/runcrew/[id]/runs` - Create/list runs
- `/api/runcrew/[id]/announcements` - Announcements
- `/api/runcrew/[id]/messages` - Messages
- `/api/garmin/webhook` - Garmin webhook

### ❌ Need to Create
- `/api/activities/*` - Activity endpoints
- `/api/runcrew/[id]/events/*` - Event endpoints
- `/api/runcrew/[id]/leaderboard` - Leaderboard
- `/api/runcrew/[id]/runs/[runId]` - Run detail

---

**Last Updated**: January 2025  
**Status**: MVP1 Complete, MVP2 Planning Phase

