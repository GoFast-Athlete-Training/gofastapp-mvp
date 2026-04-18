# Workouts Implementation Summary

## ✅ Completed

### 1. Schema Update
- Updated `workouts` table to align with Garmin structure:
  - Added `garminWorkoutId` (Int, unique) - stores Garmin's workout ID after push
  - Added `garminSyncedAt` (DateTime) - tracks when pushed to Garmin
  - Added `steps` (Json) - stores Garmin-compatible step structure
  - Changed `updatedAt` to use `@updatedAt` for auto-updates

### 2. Garmin Integration Library
Created `/lib/garmin-workouts/` with:
- **types.ts** - All Garmin enums and types (Sport, Intensity, DurationType, TargetType, etc.)
- **converters.ts** - Conversion functions from our model to Garmin format
- **api-client.ts** - Garmin API client (create, get, update, delete workouts)
- Activity → planned workout matching lives in `lib/training/match-activity-to-workout.ts` (materialized `workouts` rows)

### 3. UI Implementation

**Workouts List Page** (`/app/workouts/page.tsx`):
- Toggle between "Plan" and "See Activity" views
- Create workout button
- List of workouts with Garmin sync status

**Create Workout Page** (`/app/workouts/create/page.tsx`):
- Name and Description fields
- Overall goals: Miles, Pace, HR
- Toggle: "Do you want specific segments?"
- Segment builder with:
  - Title (e.g., Warmup, Main Set, Cooldown)
  - Miles
  - Pace (e.g., "8:00/mile")
  - HR (min-max range)
  - Repeat count (for intervals: "repeat this 3x")
- Converts segments to Garmin step format automatically

### 4. API Routes

**GET/POST `/api/workouts`**:
- List workouts for authenticated athlete
- Create new workout

**POST `/api/workouts/[id]/push-to-garmin`**:
- Converts workout to Garmin format
- Pushes to Garmin Connect
- Stores `garminWorkoutId` and `garminSyncedAt`

### 5. Navigation
- Added "Workouts" link to TopNav (Calendar icon)

## 🎯 Key Features

1. **Workout Structure**:
   - Simple mode: Overall miles/pace/HR
   - Segments mode: Multiple segments with repeats support
   - Automatically converts to Garmin step format

2. **Garmin Integration**:
   - Stores Garmin workout ID for tracking
   - Can push workouts to Garmin Connect
   - Activities can be linked back via activity mapper

3. **Segment Builder**:
   - Supports warmup/main/cooldown segments
   - Repeat functionality for intervals (e.g., "repeat 3x")
   - Each segment can have pace and/or HR targets

## 📋 Next Steps

1. **Migration**: Run `prisma migrate dev` to apply schema changes
2. **Test**: Test workout creation and Garmin push flow
3. **Activity View**: Implement activity listing (currently placeholder)
4. **Workout Edit**: Add edit/delete functionality
5. **Garmin Auth**: Ensure Garmin OAuth is working for workout push

## 🔗 Files Created/Modified

- `prisma/schema.prisma` - Updated workouts model
- `app/workouts/page.tsx` - List page
- `app/workouts/create/page.tsx` - Create page
- `app/api/workouts/route.ts` - CRUD API
- `app/api/workouts/[id]/push-to-garmin/route.ts` - Garmin push
- `lib/garmin-workouts/*` - Garmin integration library
- `components/shared/TopNav.tsx` - Added Workouts link
