# GoFast Next.js App Architecture Analysis

**Date**: January 2025  
**Purpose**: Comprehensive analysis comparing `gofastapp-mvp` (Next.js) with `gofastfrontend-mvp1` and `gofastbackendv2-fall2025`  
**Goal**: Make Next.js app match frontend MVP1 feature parity and detail level

---

## Executive Summary

The Next.js app (`gofastapp-mvp`) has the **scaffolding** but is missing **detailed implementation** compared to the frontend MVP1. Key gaps:

1. **Profile Schema Field Naming Mismatch** - Next.js uses `my*` prefix, backend uses different names
2. **Incomplete Profile Display** - Only shows basic fields, missing beautiful card-based UI
3. **Missing Edit Profile Page** - No separate edit profile component
4. **Missing Profile Fields** - Not all schema fields are displayed/editable
5. **Component Parity** - Missing several key components from MVP1

---

## 1. Database Schema Comparison

### Athlete Model Field Comparison

| Field Category | Backend v2 (Source of Truth) | Next.js App | Status |
|--------------|------------------------------|-------------|--------|
| **Core Identity** | | | |
| `id` | ✅ String (cuid) | ✅ String (cuid) | ✅ Match |
| `firebaseId` | ✅ String @unique | ✅ String @unique | ✅ Match |
| `email` | ✅ String @unique (NOT NULL) | ⚠️ String? (nullable) | ❌ **MISMATCH** |
| **Universal Profile** | | | |
| `firstName` | ✅ String? | ✅ String? | ✅ Match |
| `lastName` | ✅ String? | ✅ String? | ✅ Match |
| `phoneNumber` | ✅ String? | ✅ String? | ✅ Match |
| `gofastHandle` | ✅ String? @unique | ✅ String? @unique | ✅ Match |
| `birthday` | ✅ DateTime? | ✅ DateTime? | ✅ Match |
| `gender` | ✅ String? | ✅ String? | ✅ Match |
| `city` | ✅ String? | ✅ String? | ✅ Match |
| `state` | ✅ String? | ✅ String? | ✅ Match |
| `primarySport` | ✅ String? | ✅ String? | ✅ Match |
| `photoURL` | ✅ String? | ✅ String? | ✅ Match |
| `bio` | ✅ String? | ✅ String? | ✅ Match |
| `instagram` | ✅ String? | ✅ String? | ✅ Match |
| `status` | ✅ String? | ❌ Missing | ❌ **MISSING** |
| **Training Profile** | | | |
| `currentPace` | ✅ String? | ❌ Missing (has `myCurrentPace`) | ❌ **NAMING MISMATCH** |
| `weeklyMileage` | ✅ Int? | ❌ Missing (has `myWeeklyMileage`) | ❌ **NAMING MISMATCH** |
| `trainingGoal` | ✅ String? | ❌ Missing (has `myTrainingGoal`) | ❌ **NAMING MISMATCH** |
| `targetRace` | ✅ String? | ❌ Missing (has `myTargetRace`) | ❌ **NAMING MISMATCH** |
| `trainingStartDate` | ✅ DateTime? | ❌ Missing (has `myTrainingStartDate`) | ❌ **NAMING MISMATCH** |
| **Match Profile** | | | |
| `preferredDistance` | ✅ String? | ✅ String? | ✅ Match |
| `timePreference` | ✅ String? | ✅ String? | ✅ Match |
| `paceRange` | ✅ String? | ❌ Missing (has `myPaceRange`) | ❌ **NAMING MISMATCH** |
| `runningGoals` | ✅ String? | ❌ Missing (has `myRunningGoals`) | ❌ **NAMING MISMATCH** |
| **Garmin Integration** | | | |
| All Garmin fields | ✅ Complete | ✅ Complete | ✅ Match |
| **Strava Integration** | | | |
| All Strava fields | ✅ Complete | ✅ Complete | ✅ Match |
| **Company Link** | | | |
| `companyId` | ❌ Not in backend | ✅ String (required) | ⚠️ **Next.js only** |

### Schema Issues Summary

1. **Field Naming Mismatch**: Next.js uses `my*` prefix for training/match fields, backend uses different names
2. **Missing `status` field**: Backend has it, Next.js doesn't
3. **Email nullable mismatch**: Backend requires email (NOT NULL), Next.js has it nullable
4. **Company ID**: Next.js has single-tenant `companyId`, backend doesn't (this may be intentional)

---

## 2. Profile Component Comparison

### Profile Display (`/athlete-profile` or `/profile`)

| Feature | Frontend MVP1 | Next.js App | Status |
|---------|---------------|-------------|--------|
| **Component** | `AthleteProfile.jsx` | `app/profile/page.tsx` | ✅ Exists |
| **UI Design** | Beautiful card-based grid layout | Basic list display | ❌ **NEEDS UPGRADE** |
| **Fields Displayed** | All profile fields with icons | Only 5-6 basic fields | ❌ **INCOMPLETE** |
| **Profile Photo** | Large 32x32 with ring border | Not displayed | ❌ **MISSING** |
| **Edit Button** | ✅ Navigates to edit page | ❌ No edit button | ❌ **MISSING** |
| **Settings Button** | ✅ Navigates to settings | ❌ Missing | ❌ **MISSING** |
| **Back to Home** | ✅ Navigation button | ❌ Missing | ❌ **MISSING** |
| **Card Icons** | ✅ Each field has icon | ❌ No icons | ❌ **MISSING** |
| **Conditional Rendering** | ✅ Only shows fields with data | ⚠️ Partial | ⚠️ **PARTIAL** |

**Missing Fields in Next.js Profile Display:**
- `gofastHandle` (displayed in MVP1)
- `birthday` (displayed in MVP1)
- `gender` (displayed in MVP1)
- `instagram` (displayed in MVP1)
- `phoneNumber` (not in MVP1, but should be available)
- Profile photo display
- Age calculation from birthday

### Profile Edit (`/athlete-edit-profile`)

| Feature | Frontend MVP1 | Next.js App | Status |
|---------|---------------|-------------|--------|
| **Component** | `EditProfile.jsx` | ❌ Missing | ❌ **MISSING** |
| **Route** | `/athlete-edit-profile` | ❌ No route | ❌ **MISSING** |
| **Pre-fills Data** | ✅ Loads from localStorage | N/A | ❌ **MISSING** |
| **All Fields Editable** | ✅ All profile fields | N/A | ❌ **MISSING** |
| **Photo Upload** | ✅ File upload support | N/A | ❌ **MISSING** |
| **Cancel Button** | ✅ Navigates back | N/A | ❌ **MISSING** |
| **Save Changes** | ✅ Updates via PUT /profile | N/A | ❌ **MISSING** |

**Issue**: Next.js only has `athlete-create-profile` which is for new users. There's no separate edit profile page for existing users.

### Profile Create (`/athlete-create-profile`)

| Feature | Frontend MVP1 | Next.js App | Status |
|---------|---------------|-------------|--------|
| **Component** | `AthleteCreateProfile.jsx` | `app/athlete-create-profile/page.tsx` | ✅ Exists |
| **All Fields** | ✅ All universal profile fields | ✅ All universal profile fields | ✅ Match |
| **Handle Validation** | ✅ Real-time uniqueness check | ✅ Real-time uniqueness check | ✅ Match |
| **Photo Upload** | ✅ File upload + preview | ✅ File upload + preview | ✅ Match |
| **Firebase Prefill** | ✅ Pre-fills from Firebase | ✅ Pre-fills from Firebase | ✅ Match |
| **LocalStorage Prefill** | ✅ Pre-fills from localStorage | ✅ Pre-fills from localStorage | ✅ Match |
| **Error Handling** | ✅ Comprehensive | ✅ Comprehensive | ✅ Match |

**Status**: ✅ Profile create is well-implemented and matches MVP1

---

## 3. Athlete Home Comparison

### Athlete Home (`/athlete-home`)

| Feature | Frontend MVP1 | Next.js App | Status |
|---------|---------------|-------------|--------|
| **Component** | `AthleteHome.jsx` | `app/athlete-home/page.tsx` | ✅ Exists |
| **Dashboard Layout** | ✅ Full dashboard with sidebar | ✅ Full dashboard | ✅ Match |
| **Weekly Stats** | ✅ Weekly activity totals | ✅ Weekly activity totals | ✅ Match |
| **Latest Activity** | ✅ Latest activity card | ✅ Latest activity card | ✅ Match |
| **Next Run RSVP** | ✅ RSVP card for next run | ✅ RSVP card | ✅ Match |
| **Crew Hero** | ✅ Crew information display | ✅ Crew information | ✅ Match |
| **Garmin Status** | ✅ Connection status check | ✅ Connection status check | ✅ Match |
| **Navigation** | ✅ Sidebar navigation | ⚠️ Different structure | ⚠️ **DIFFERENT** |

**Status**: ✅ Athlete home is well-implemented, minor navigation differences

---

## 4. Missing Components & Pages

### Missing Pages

| Page | Frontend MVP1 Route | Next.js App | Priority |
|------|---------------------|-------------|----------|
| **Edit Profile** | `/athlete-edit-profile` | ❌ Missing | 🔴 **HIGH** |
| **Profile Display** | `/athlete-profile` | ⚠️ Basic `/profile` exists | 🔴 **HIGH** |
| **My Activities** | `/my-activities` | ✅ `/activities` exists | ✅ Exists |
| **Activity Detail** | `/activity/:id` | ✅ `/activities/[id]` exists | ✅ Exists |
| **Settings** | `/settings` | ✅ `/settings` exists | ✅ Exists |

### Missing Components

| Component | Frontend MVP1 | Next.js App | Priority |
|-----------|---------------|-------------|----------|
| **Beautiful Profile Display** | `AthleteProfile.jsx` (card-based) | ❌ Basic version only | 🔴 **HIGH** |
| **Edit Profile Form** | `EditProfile.jsx` | ❌ Missing | 🔴 **HIGH** |
| **Profile Card Components** | Individual field cards | ❌ Missing | 🟡 **MEDIUM** |

---

## 5. Field Display Completeness

### Profile Fields Display Status

| Field | In Schema | In Create Form | In Profile Display | In Edit Form |
|-------|-----------|---------------|-------------------|--------------|
| `firstName` | ✅ | ✅ | ✅ | ❌ Missing |
| `lastName` | ✅ | ✅ | ✅ | ❌ Missing |
| `email` | ✅ | ✅ | ✅ | ❌ Missing |
| `phoneNumber` | ✅ | ✅ | ❌ | ❌ Missing |
| `gofastHandle` | ✅ | ✅ | ❌ | ❌ Missing |
| `birthday` | ✅ | ✅ | ❌ | ❌ Missing |
| `gender` | ✅ | ✅ | ❌ | ❌ Missing |
| `city` | ✅ | ✅ | ✅ | ❌ Missing |
| `state` | ✅ | ✅ | ✅ | ❌ Missing |
| `primarySport` | ✅ | ✅ | ✅ | ❌ Missing |
| `photoURL` | ✅ | ✅ | ❌ | ❌ Missing |
| `bio` | ✅ | ✅ | ✅ | ❌ Missing |
| `instagram` | ✅ | ✅ | ❌ | ❌ Missing |
| `status` | ❌ Missing | ❌ | ❌ | ❌ |
| Training fields | ⚠️ Wrong names | ❌ | ❌ | ❌ |
| Match fields | ⚠️ Wrong names | ❌ | ❌ | ❌ |

**Summary**: 
- ✅ Create form has all universal profile fields
- ❌ Profile display missing 7+ fields
- ❌ Edit form doesn't exist
- ⚠️ Training/Match fields have naming issues

---

## 6. API Route Comparison

### Athlete API Routes

| Route | Frontend MVP1 | Next.js App | Status |
|-------|---------------|-------------|--------|
| `POST /api/athlete/create` | ✅ Used | ✅ Exists | ✅ Match |
| `PUT /api/athlete/:id/profile` | ✅ Used | ✅ Exists | ✅ Match |
| `GET /api/athlete/hydrate` | ✅ Used | ✅ Exists | ✅ Match |
| `GET /api/athlete/check-handle` | ✅ Used | ✅ Exists | ✅ Match |
| `GET /api/athlete/:id` | ✅ Used | ✅ Exists | ✅ Match |

**Status**: ✅ API routes are complete and match MVP1

---

## 7. Key Issues Summary

### Critical Issues (Must Fix)

1. **❌ Field Naming Mismatch**: Training/Match fields use `my*` prefix in Next.js but backend uses different names
   - Next.js: `myCurrentPace`, `myWeeklyMileage`, `myTrainingGoal`, `myTargetRace`, `myTrainingStartDate`
   - Backend: `currentPace`, `weeklyMileage`, `trainingGoal`, `targetRace`, `trainingStartDate`
   - Next.js: `myPaceRange`, `myRunningGoals`
   - Backend: `paceRange`, `runningGoals`

2. **❌ Missing Edit Profile Page**: No separate edit profile component for existing users

3. **❌ Incomplete Profile Display**: Only shows 5-6 fields, missing 7+ fields from MVP1

4. **❌ Missing `status` Field**: Backend has it, Next.js schema doesn't

5. **⚠️ Email Field Mismatch**: Backend requires email (NOT NULL), Next.js has it nullable

### Medium Priority Issues

6. **⚠️ Profile Display UI**: Basic list instead of beautiful card-based grid from MVP1

7. **⚠️ Missing Profile Photo Display**: Not shown on profile page

8. **⚠️ Missing Navigation Buttons**: No edit, settings, or back buttons on profile page

---

## 8. Recommendations

### Immediate Actions

1. **Fix Schema Field Names**: Align Next.js schema with backend v2 (remove `my*` prefix)
2. **Add Missing Fields**: Add `status` field to Next.js schema
3. **Create Edit Profile Page**: Build `/athlete-edit-profile` route and component
4. **Enhance Profile Display**: Rebuild `/profile` page to match MVP1's beautiful card-based design
5. **Display All Fields**: Show all profile fields in profile display page

### Future Enhancements

6. Add profile completion calculation
7. Add profile picture upload integration
8. Add profile completion reminders
9. Add training/match profile setup components (when those features are built)

---

## 9. Architecture Alignment Strategy

### Phase 1: Schema Alignment
- Fix field naming mismatches
- Add missing fields
- Ensure email constraint matches backend

### Phase 2: Profile Display Enhancement
- Rebuild profile page with card-based design
- Display all profile fields
- Add navigation buttons
- Add profile photo display

### Phase 3: Edit Profile Implementation
- Create edit profile page
- Pre-fill from localStorage
- Add all field editing
- Add photo upload

### Phase 4: Testing & Validation
- Test all profile flows
- Validate field completeness
- Ensure API compatibility

---

**Last Updated**: January 2025  
**Status**: Analysis Complete - Ready for Implementation

