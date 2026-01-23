# City Runs - Phase Plan

## Overview

Implementation plan for City Runs feature, starting with admin creation in GoFastCompany, with dual compatibility for both public city runs and private crew runs.

## Key Design: Build Once, Copy UX

**Phase 1 (Now)**: Admin creation in GoFastCompany
- Build the form/UX in GoFastCompany
- Form supports both public city runs (`runCrewId = null`) and private crew runs (`runCrewId = set`)
- Single API endpoint handles both types
- Same model (`city_runs`), different `runCrewId` value determines visibility
- **Prove it works** with admin creation

**Phase 4 (Future)**: User-generated runs
- **Copy the proven UX** from GoFastCompany to GoFastAthlete
- Same form component, same API, same model
- Different auth context (user vs admin)
- Users can only create public runs (hide `runCrewId` option in user form)
- Admin form still works for both types

**Why This Approach:**
- ✅ **Build once, reuse** - Same model = same UX, just copy between repos
- ✅ **Prove it first** - Validate UX/API with admin before user-facing
- ✅ **No duplication** - One model, one API, shared RSVP system
- ✅ **Easy to make crew runs public** (set `runCrewId = null`)
- ✅ **Backwards compatible** - Table name unchanged

---

## Phase 1: Admin Creation (GoFastCompany)

### Goal
Enable admins to create runs (both public city runs and private crew runs) from GoFastCompany app management interface.

### Tasks

#### 1.1 Navigation Setup
- [ ] Add "Runs" section to left nav bar in GoFastCompany app management
- [ ] Create `/app-management/runs` route/page
- [ ] Add "Create Run" button/CTA

#### 1.2 Create Run Form
- [ ] Create `/app-management/runs/create` page
- [ ] Form fields (mirrors RunCrewRun structure):
  - **City Selection** (required) - Dropdown/select from `cities` table
  - **Run Type** - Radio: "Public City Run" vs "Private Crew Run"
    - If "Private Crew Run" → Show `runCrewId` dropdown (filter by city, from gofastapp-mvp `run_crews`)
    - If "Public City Run" → `runCrewId` stays null
  - **RunClub Affiliation** (optional) - Dropdown/select from `RunClub` table (in GoFastCompany)
    - Shows official RunClubs (e.g., "Boston Running Club", "DC Road Runners")
    - Stores as `runClubSlug` (string reference, not FK - cross-repo)
    - Used for tracking which official organization hosts the run
  - **Title** (required)
  - **Date** (required)
  - **Time Fields**: `startTimeHour`, `startTimeMinute`, `startTimePeriod`
  - **Timezone** (optional)
  - **Meet Up Point** (required)
  - **Meet Up Address** (optional)
  - **Meet Up Place ID** (optional - Google Places)
  - **Meet Up Lat/Lng** (optional)
  - **Recurrence**: `recurrenceRule`, `recurrenceEndsOn`, `recurrenceNote`
  - **Run Details**: `totalMiles`, `pace`, `stravaMapUrl`, `description`
  - **Created By** - Auto-populate from logged-in admin

#### 1.3 API Route
- [ ] Create `POST /api/runs/create` endpoint in GoFastCompany
- [ ] Validate:
  - `cityId` is required
  - If `runCrewId` is set, verify crew exists (via API call to gofastapp-mvp)
  - If `runClubSlug` is set, verify RunClub exists in GoFastCompany
  - All required fields present
- [ ] Save to `city_runs` table in gofastapp-mvp database (backwards compatible: `run_crew_runs`)
- [ ] `runClubSlug` stored as string (no FK - cross-repo reference)
- [ ] Return created run with success response

#### 1.4 Form Submission Flow
- [ ] Handle form submission
- [ ] Call API endpoint
- [ ] Show success message
- [ ] Redirect to runs list or run detail page

#### 1.5 Runs List View
- [ ] Create `/app-management/runs` list page
- [ ] Display all runs (public and private)
- [ ] Filter by:
  - City
  - Run type (public vs private)
  - Date range
- [ ] Show key info: title, city, date, run type badge
- [ ] Link to edit/delete (future phases)

### Technical Details

**File Locations:**
- Navigation: `/GoFastCompany/app/dashboard/layout.tsx` (add to FEATURES array, category: "app-management")
- Create Page: `/GoFastCompany/app/dashboard/runs/create/page.tsx`
- List Page: `/GoFastCompany/app/dashboard/runs/page.tsx`
- API Route: `/GoFastCompany/app/api/runs/create/route.ts`

**Navigation Addition:**
Add to `FEATURES` array in `layout.tsx`:
```typescript
{
  id: "runs",
  name: "Runs",
  icon: MapPin, // or Calendar, or Activity
  path: "/dashboard/runs",
  description: "Create and manage city runs (public & private)",
  category: "app-management",
  hasIntegration: true,
}
```

**Database:**
- Write to `city_runs` model in gofastapp-mvp (table: `run_crew_runs`)
- Required: `cityId`, `createdById`, `title`, `date`, `meetUpPoint`
- Optional: 
  - `runCrewId` (null for public, set for private app group runs)
  - `runClubSlug` (string reference to RunClub.slug in GoFastCompany - for official run club affiliation)

**Dual Compatibility:**
- Form handles both public and private runs
- Single API endpoint for both types
- Same model, different `runCrewId` value

---

## Phase 2: Public Discovery (GoFastAthlete App)

### Goal
Enable users to discover and browse public city runs in the GoFastAthlete app.

### Tasks

#### 2.1 Navigation Integration
- [ ] Add "Search Runs" to left nav bar on athlete home
- [ ] Create `/runs` route/page
- [ ] Public access (no auth required for browsing)

#### 2.2 Runs Discovery Page
- [ ] Display public runs (`runCrewId IS NULL`)
- [ ] Filter by:
  - City (required or default to user's city)
  - Date range
  - Pace
  - Distance
- [ ] Sort by: date (upcoming first), distance, pace
- [ ] Show run cards with:
  - Title
  - Date & time
  - Location (meetUpPoint)
  - Pace, distance
  - RSVP count
  - "RSVP" button

#### 2.3 Run Detail Page
- [ ] Create `/runs/[id]` page
- [ ] Show full run details
- [ ] RSVP functionality (Phase 3)
- [ ] Map view (if coordinates available)

#### 2.4 API Routes
- [ ] `GET /api/runs` - List public runs (filtered by city, date, etc.)
- [ ] `GET /api/runs/[id]` - Get single run details
- [ ] Query: `WHERE runCrewId IS NULL` for public runs

---

## Phase 3: RSVP System

### Goal
Enable users to RSVP to public city runs.

### Tasks

#### 3.1 RSVP API
- [ ] `POST /api/runs/[id]/rsvp` - Create RSVP
- [ ] `DELETE /api/runs/[id]/rsvp` - Cancel RSVP
- [ ] `GET /api/runs/[id]/rsvps` - List RSVPs for a run
- [ ] Use existing `run_crew_run_rsvps` table (works for both types)

#### 3.2 RSVP UI
- [ ] RSVP button on run detail page
- [ ] Show RSVP status (going/not going)
- [ ] RSVP list/count on run cards
- [ ] "My RSVPs" page (authenticated users)

#### 3.3 Auth Considerations
- [ ] Guest RSVP? (may require email/phone)
- [ ] Authenticated RSVP? (preferred)
- [ ] RSVP notifications (future)

---

## Phase 4: User-Generated Runs (Future)

### Goal
Enable regular users (not just admins) to create public city runs.

### Tasks

#### 4.1 User Creation Form
- [ ] **Copy form component** from GoFastCompany to GoFastAthlete
- [ ] Create `/runs/create` page in GoFastAthlete app
- [ ] Reuse same form UX (proven in Phase 1)
- [ ] Only allow public city runs (hide `runCrewId` option)
- [ ] Auto-set `createdById` to logged-in user
- [ ] Same API endpoint, different auth context

#### 4.2 Permissions & Moderation
- [ ] User can create runs
- [ ] User can edit/delete their own runs
- [ ] Admin can moderate/delete any run
- [ ] Approval workflow? (optional)

#### 4.3 API Updates
- [ ] Update create endpoint to handle user creation
- [ ] Add edit/delete endpoints
- [ ] Permission checks

---

## Phase 5: SEO & Public Pages

### Goal
Public-facing SEO pages for city runs discovery.

### Tasks

#### 5.1 City Landing Pages
- [ ] Create `/dc-runs`, `/boston-runs` etc. pages
- [ ] SEO-optimized content
- [ ] "See local runs" CTA → redirects to app

#### 5.2 City Page Hub
- [ ] Hub page with city info
- [ ] "See local runs in this city" link
- [ ] Transitions to app discovery

---

## Implementation Notes

### Dual Compatibility Strategy

**Form Design:**
```
Run Type: [ ] Public City Run  [ ] Private Crew Run

If "Private Crew Run":
  → Show Crew dropdown (filtered by selected city)
  → Set runCrewId to selected crew
  
If "Public City Run":
  → Hide Crew dropdown
  → runCrewId = null
```

**API Design:**
- Single endpoint handles both types
- `runCrewId` presence determines type
- Validation ensures crew belongs to city if set

**Query Patterns:**
- Public runs: `WHERE runCrewId IS NULL AND cityId = ?`
- Private runs: `WHERE runCrewId = ?`
- All runs in city: `WHERE cityId = ?`
- Runs by RunClub: `WHERE runClubSlug = ?` (string match, not FK)
- Official runs (with RunClub): `WHERE runClubSlug IS NOT NULL`

### Migration Path to User-Generated

**Phase 1 (Admin Only - Prove It):**
- Build form/UX in GoFastCompany
- Only admins can create
- Both types supported (public & private)
- **Goal**: Validate UX, API, and data model work correctly

**Phase 4 (User-Generated - Copy UX):**
- **Copy proven form component** from GoFastCompany to GoFastAthlete
- Same form, same API, same model (`city_runs`)
- Users can create public runs (hide `runCrewId` option)
- Different auth context (user vs admin)
- Admin form still works for both types
- **Benefit**: No need to rebuild - just copy and adapt

### Technical Considerations

**Database:**
- Existing `city_runs` model (table: `run_crew_runs`)
- Existing `run_crew_run_rsvps` table works for both
- No schema changes needed for Phase 1-3

**Authentication:**
- GoFastCompany: Admin auth required
- GoFastAthlete: Public browsing, auth for RSVP
- Future: Auth for user creation

**City Data:**
- Need to seed `cities` table with initial cities
- Or create cities on-the-fly in form?

---

## Success Criteria

### Phase 1 Complete When:
- ✅ Admin can navigate to "Create Run" from GoFastCompany
- ✅ Form allows creating both public and private runs
- ✅ Runs save correctly to database
- ✅ Runs list displays created runs
- ✅ Dual compatibility works (public vs private)

### Phase 2 Complete When:
- ✅ Users can browse public runs in app
- ✅ Filtering and sorting works
- ✅ Run detail pages display correctly

### Phase 3 Complete When:
- ✅ Users can RSVP to public runs
- ✅ RSVP status displays correctly
- ✅ RSVP list works

---

## Open Questions

1. **City Creation**: Do we create cities in the form, or pre-seed them?
2. **Guest RSVP**: Allow guest RSVPs or require auth?
3. **Run Editing**: Can admins edit runs? Can users edit their own?
4. **Run Deletion**: Soft delete or hard delete?
5. **Notifications**: Email/SMS for RSVP confirmations?
6. **Moderation**: Approval workflow for user-generated runs?

---

*Last Updated: [Current Date]*  
*Status: Phase 1 Planning Complete, Ready for Implementation*

