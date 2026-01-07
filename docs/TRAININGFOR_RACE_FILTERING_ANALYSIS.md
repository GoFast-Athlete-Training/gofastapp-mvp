# trainingForRace & trainingForDistance - Filtering Analysis

**Date:** 2025-01-XX  
**Status:** ⚠️ **Fields exist but not implemented for filtering**

---

## Current State

### ✅ What EXISTS

1. **Database Schema** (`prisma/schema.prisma`):
   ```prisma
   model run_crews {
     trainingForRace         String? // race_registry.id (nullable)
     trainingForDistance     TrainingForDistance[]     @default([])
     race_registry           race_registry?            @relation("TrainingForRace", fields: [trainingForRace], references: [id], onDelete: SetNull)
   }
   
   model race_registry {
     id                      String                    @id
     name                    String
     // ... other fields
     training_plans          training_plans[]          // Individual training plans
     run_crews_training_for  run_crews[]               @relation("TrainingForRace")  // Run crews training for this race
     run_crew_specific_races run_crew_specific_races[] // Many-to-many junction table
   }
   
   enum TrainingForDistance {
     FiveK
     TenK
     HalfMarathon
     Marathon
     Ultra
   }
   
   model race_registry {
     id                      String                    @id
     name                    String
     raceType                String
     miles                   Float
     date                    DateTime
     city                    String?
     state                   String?
     country                 String?
   }
   ```

2. **API Accepts Fields** (`app/api/runcrew/create/route.ts`):
   - Accepts `trainingForRace` and `trainingForDistance` in POST body
   - Passes them to `createCrew()` function

3. **Domain Function** (`lib/domain-runcrew.ts`):
   - `createCrew()` accepts and saves `trainingForRace` and `trainingForDistance`

---

## ❌ What's MISSING

### 1. **Create Crew Form UI** (`app/runcrew/create/page.tsx`)
- ❌ No UI fields to select a race from `race_registry`
- ❌ No UI to select training distances (FiveK, TenK, etc.)
- ❌ Form data doesn't include these fields
- ❌ Form submission doesn't send these fields to API

### 2. **Discovery/Filtering API** (`app/api/runcrew/discover/route.ts`)
- ❌ Doesn't accept `trainingForRace` as query parameter
- ❌ Doesn't accept `trainingForDistance` as query parameter
- ❌ Doesn't pass these to `getDiscoverableRunCrews()`

### 3. **Discovery Function** (`lib/domain-runcrew.ts::getDiscoverableRunCrews()`)
- ❌ Options interface doesn't include `trainingForRace` or `trainingForDistance`
- ❌ Where clause doesn't filter by these fields
- ❌ Select statement doesn't return these fields in results

### 4. **Discovery Page UI** (`app/runcrew/page.tsx`)
- ❌ No filter UI for "Training For Race"
- ❌ No filter UI for "Training For Distance"
- ❌ Filter state variables don't exist
- ❌ Filter application doesn't send these params

---

## What Needs to Be Implemented

### Phase 1: Add Fields to Create Form

1. **Add Race Selection**:
   - Fetch races from `race_registry` table (or API endpoint)
   - Add dropdown/autocomplete to select a race
   - Store `raceRegistryId` in form state

2. **Add Distance Selection**:
   - Add multi-select checkboxes for training distances:
     - 5K
     - 10K
     - Half Marathon
     - Marathon
     - Ultra
   - Store array in form state

3. **Update Form Submission**:
   - Include `trainingForRace` and `trainingForDistance` in API call

### Phase 2: Add Filtering Support

1. **Update Discovery API** (`app/api/runcrew/discover/route.ts`):
   ```typescript
   const trainingForRace = searchParams.get('trainingForRace') || undefined;
   const trainingForDistance = searchParams.getAll('trainingForDistance');
   ```

2. **Update Discovery Function** (`lib/domain-runcrew.ts::getDiscoverableRunCrews()`):
   ```typescript
   export async function getDiscoverableRunCrews(options?: {
     // ... existing options
     trainingForRace?: string;
     trainingForDistance?: string[];
   })
   
   // Add to where clause:
   if (options?.trainingForRace) {
     where.trainingForRace = options.trainingForRace;
   }
   
   if (options?.trainingForDistance && options.trainingForDistance.length > 0) {
     where.trainingForDistance = {
       hasSome: options.trainingForDistance,
     };
   }
   ```

3. **Include in Select Statement**:
   ```typescript
   select: {
     // ... existing fields
     trainingForRace: true,
     trainingForDistance: true,
   }
   ```

4. **Include in Response Formatting**:
   - Return `trainingForRace` and `trainingForDistance` in mapped results
   - Optionally join race data if needed for display

### Phase 3: Add Filter UI

1. **Add Filter State** (`app/runcrew/page.tsx`):
   ```typescript
   const [filterTrainingForRace, setFilterTrainingForRace] = useState('');
   const [filterTrainingForDistance, setFilterTrainingForDistance] = useState<string[]>([]);
   ```

2. **Add Filter UI Components**:
   - Race selector (dropdown/autocomplete)
   - Distance multi-select checkboxes

3. **Update API Call**:
   - Include filter params in `fetchRunCrews()`

4. **Display in Results**:
   - Show training race and distances in crew cards

---

## Database Query Considerations

### Foreign Key Relationship ✅
- **`run_crews.trainingForRace`** has a foreign key to `race_registry.id`
- This enables querying **all athletes training for a race**:
  - **Individual Training Plans**: `training_plans` → `race_registry` (via `raceId`)
  - **Run Crews**: `run_crews` → `race_registry` (via `trainingForRace` foreign key)
  - **Run Crew Members**: `run_crew_memberships` → `run_crews` → `race_registry`
  
### Query Example: All People Training for a Race
```typescript
// Get all athletes training for a specific race (raceId)
const race = await prisma.race_registry.findUnique({
  where: { id: raceId },
  include: {
    // Individual training plans
    training_plans: {
      include: { Athlete: true }
    },
    // Run crews training for this race
    run_crews_training_for: {
      include: {
        run_crew_memberships: {
          include: { Athlete: true }
        }
      }
    },
    // Run crews linked via junction table (if needed)
    run_crew_specific_races: {
      include: {
        runCrew: {
          include: {
            run_crew_memberships: {
              include: { Athlete: true }
            }
          }
        }
      }
    }
  }
});

// Extract all unique athletes
const athletes = [
  ...race.training_plans.map(tp => tp.Athlete),
  ...race.run_crews_training_for.flatMap(crew => 
    crew.run_crew_memberships.map(m => m.Athlete)
  )
];
```

### trainingForRace Filter
- Filter by exact match: `where.trainingForRace = options.trainingForRace`
- This filters crews training for a specific race (by race_registry.id)
- Uses foreign key relationship for efficient joins

### trainingForDistance Filter
- Filter by array overlap: `where.trainingForDistance = { hasSome: options.trainingForDistance }`
- This filters crews that train for ANY of the selected distances

### Combined Filtering
- If both filters are set, crews must match BOTH:
  - Training for the specified race AND
  - Training for one of the specified distances

---

## API Endpoints Needed

### Get Races List
**Need to create:** `GET /api/race-registry` or similar
- Returns list of races for dropdown
- Should include: id, name, date, city, state, miles

**Current Status:** ❌ Doesn't exist (need to check if race_registry is populated)

---

## Example Implementation Flow

### Creating a Crew with Training Info:
1. User fills out create form
2. Selects race from dropdown (e.g., "Boston Marathon 2025")
3. Selects distances (e.g., ["Marathon"])
4. Form submits with:
   ```json
   {
     "name": "Boston Training Crew",
     "trainingForRace": "race_registry_id_123",
     "trainingForDistance": ["Marathon"]
   }
   ```
5. Crew is created with these fields

### Filtering Crews:
1. User goes to discovery page
2. Selects filter: "Training For Race" → "Boston Marathon 2025"
3. Selects filter: "Training For Distance" → ["Marathon", "HalfMarathon"]
4. API call: `/api/runcrew/discover?trainingForRace=race_registry_id_123&trainingForDistance=Marathon&trainingForDistance=HalfMarathon`
5. Results show only crews matching filters

---

## Related Files

- **Schema:** `/prisma/schema.prisma` (lines 352-363)
- **Migration:** `/prisma/migrations/20250116000000_add_training_for_race_foreign_key/migration.sql`
- **Domain Function:** `/lib/domain-runcrew.ts` (createCrew, getDiscoverableRunCrews)
- **Create API:** `/app/api/runcrew/create/route.ts`
- **Discovery API:** `/app/api/runcrew/discover/route.ts`
- **Create Form:** `/app/runcrew/create/page.tsx`
- **Discovery Page:** `/app/runcrew/page.tsx`

---

## Questions to Answer

1. **Race Registry Data:**
   - Is `race_registry` table populated with races?
   - Do we need an API endpoint to fetch races?
   - Should races be searchable by name/location?

2. **UI/UX:**
   - Should race selection be required or optional?
   - Can a crew train for multiple races? (currently single race via `trainingForRace`)
   - Should distance selection be required if race is selected?

3. **Filtering Logic:**
   - Should "Training For Race" filter be exact match only?
   - Should distance filtering show crews that match ANY or ALL selected distances?
   - Should there be a "Show crews training for any race" option?

---

## Benefits of Foreign Key Relationship

### ✅ Unified Querying
With the foreign key relationship, you can now query **all athletes training for a specific race** in a single query:

**Sources:**
1. **Individual Training Plans** (`training_plans.raceId` → `race_registry.id`)
2. **Run Crews** (`run_crews.trainingForRace` → `race_registry.id`)
3. **Run Crew Members** (via memberships in crews training for the race)

### ✅ Data Integrity
- Foreign key constraint ensures `trainingForRace` always references a valid race
- `ON DELETE SET NULL` prevents orphaned references if a race is deleted
- Database enforces referential integrity

### ✅ Efficient Joins
- Database can optimize joins using foreign key indexes
- Enables efficient filtering and aggregations
- Better query performance for race-based analytics

### ✅ Downstream Features Enabled
- **Race Community Pages**: Show all athletes training for a race
- **Race Leaderboards**: Aggregate performance across crews and individuals
- **Training Analytics**: Compare training patterns across different groups
- **Matching**: Match athletes training for the same race

---

## Next Steps

1. ✅ Document current state (this doc)
2. ✅ Add foreign key relationship (this doc)
3. ⏳ Run migration to apply foreign key constraint
4. ⏳ Verify race_registry data availability
5. ⏳ Create race registry API endpoint (if needed)
6. ⏳ Add fields to create crew form
7. ⏳ Add filtering to discovery API
8. ⏳ Add filtering to discovery function
9. ⏳ Add filter UI to discovery page
10. ⏳ Create utility function to query all athletes training for a race
11. ⏳ Test end-to-end flow

