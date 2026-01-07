# Discovery Page - Filter/Search/Toggle Capabilities Analysis

**Page:** `/app/runcrew/page.tsx`

---

## Current Capabilities

### ✅ Search Bar (Always Visible)
- **Location:** Top of page
- **Type:** Text input
- **Functionality:** Client-side filtering of displayed results
- **Searches:** Name, description, city, state, primaryMeetUpPoint
- **Behavior:** Real-time filtering (no API call)

### ✅ Filters Toggle Button
- **Location:** Below search bar
- **State:** `showFilters` (boolean)
- **Functionality:** Shows/hides entire filter panel
- **UI:** Chevron icon rotates when open/closed

### ✅ Filter Panel (Conditional Display)
**Shown when:** `showFilters === true`

**Current Filters:**

1. **Location Filters** ✅
   - City (text input)
   - State (text input)

2. **Purpose Filter** ⚠️
   - Multi-select buttons
   - Current options: `['Training', 'Fun', 'Social']`
   - **PROBLEM:** Should be `['Training', 'Social', 'General Fitness']`

3. **Training For Race Filter** ✅ (Conditional)
   - **Shows when:** Purpose includes "Training"
   - Race search input with autocomplete
   - Race selection dropdown
   - **PROBLEM:** Should be simple yes/no toggle per MVP spec

4. **Training Distance Filter** ⚠️
   - Multi-select buttons (FiveK, TenK, HalfMarathon, Marathon, Ultra)
   - **PROBLEM:** Should NOT exist in MVP (per spec)

5. **Time Preference Filter** ⚠️
   - Multi-select buttons (Morning, Afternoon, Evening)
   - **PROBLEM:** Should NOT exist in MVP (per spec)

6. **Gender Filter** ⚠️
   - Radio buttons (male, female, both)
   - Clear option
   - **PROBLEM:** Should NOT exist in MVP (per spec)

7. **Age Range Filter** ⚠️
   - Min Age (number input)
   - Max Age (number input)
   - **PROBLEM:** Should NOT exist in MVP (per spec)

8. **Typical Run Miles Filter** ⚠️
   - Min Miles (number input)
   - Max Miles (number input)
   - **PROBLEM:** Should NOT exist in MVP (per spec)

### ✅ Apply Filters Button
- **Location:** Bottom of filter panel
- **Functionality:** Triggers API call with filter params
- **State:** Shows "Applying Filters..." when loading

### ✅ Clear All Button
- **Location:** Next to Apply Filters button
- **Functionality:** Clears all filter states and refetches

---

## Current Flow

```
User loads page
  ↓
fetchRunCrews() called (no filters)
  ↓
Results displayed
  ↓
User clicks "Filters" button
  ↓
showFilters = true → Filter panel appears
  ↓
User sets filters (city, purpose, etc.)
  ↓
User clicks "Apply Filters"
  ↓
fetchRunCrews() called with filter params
  ↓
API returns filtered results
  ↓
Results displayed
```

---

## Issues Found

### 1. **Too Many Filters for MVP**
**Current:** 8 different filter types
**MVP Should Have:** 3 filter types only

**Per MVP Spec:**
- ✅ Location (city/state)
- ✅ Purpose (Training, Social, General Fitness)
- ✅ Training for Race (yes/no toggle, only if Purpose = Training)

**Should Remove:**
- ❌ Gender
- ❌ Age Range
- ❌ Pace
- ❌ Typical Run Miles
- ❌ Time Preference
- ❌ Training Distance (specific distances)

### 2. **Purpose Options Mismatch**
**Current:** `['Training', 'Fun', 'Social']`
**Should Be:** `['Training', 'Social', 'General Fitness']`

### 3. **Training for Race Filter Too Complex**
**Current:** Full race search/autocomplete with specific race selection
**MVP Should Be:** Simple yes/no toggle (boolean filter)

### 4. **Race Search Exists But Not Needed for MVP**
The race autocomplete/search is over-engineered for MVP.
MVP just needs: "Training for a race?" → Yes/No toggle

---

## MVP Filter Structure (Per Spec)

### Filter Panel Should Contain:

1. **Location**
   - City (text input)
   - State (text input)

2. **Purpose** (Multi-select buttons)
   - Training
   - Social
   - General Fitness

3. **Training for Race?** (Only if Purpose includes "Training")
   - Simple toggle: Yes / No
   - NO race search
   - NO specific race selection
   - Just filters crews where `trainingForRace IS NOT NULL`

---

## Technical Implementation

### Current State Management
```typescript
const [showFilters, setShowFilters] = useState(false); // Toggle visibility
const [filterCity, setFilterCity] = useState('');
const [filterState, setFilterState] = useState('');
const [filterPurpose, setFilterPurpose] = useState<string[]>([]);
const [filterTrainingForRace, setFilterTrainingForRace] = useState('');
// ... many more
```

### MVP Should Have
```typescript
const [showFilters, setShowFilters] = useState(false);
const [filterCity, setFilterCity] = useState('');
const [filterState, setFilterState] = useState('');
const [filterPurpose, setFilterPurpose] = useState<string[]>([]);
const [filterTrainingForRace, setFilterTrainingForRace] = useState<boolean | null>(null); // true/false/null
```

---

## Backend API Status

### Current API Params Sent
```
?city=...
&state=...
&purpose=Training&purpose=Social
&trainingForRace=race_id
&trainingForDistance=Marathon&trainingForDistance=HalfMarathon
&gender=male
&ageMin=18
&ageMax=65
&typicalRunMilesMin=3.0
&typicalRunMilesMax=10.0
&timePreference=Morning
```

### MVP API Should Accept
```
?city=...
&state=...
&purpose=Training&purpose=Social&purpose=General Fitness
&trainingForRace=true  // or false, or omit
```

---

## Recommended Changes

### Step 1: Update Purpose Options
- Change from `['Training', 'Fun', 'Social']` 
- To `['Training', 'Social', 'General Fitness']`

### Step 2: Simplify Training for Race Filter
- Remove race search/autocomplete
- Replace with simple Yes/No toggle
- Send boolean: `trainingForRace=true` or `trainingForRace=false`

### Step 3: Remove Non-MVP Filters
- Remove Gender filter UI
- Remove Age Range filter UI
- Remove Typical Run Miles filter UI
- Remove Time Preference filter UI
- Remove Training Distance filter UI

### Step 4: Update Backend Filtering
- Update `getDiscoverableRunCrews()` to handle boolean `trainingForRace` filter
- Remove handling for non-MVP filters (or leave in DB but ignore)

---

## Summary

**What Works:**
- ✅ Toggle mechanism (showFilters)
- ✅ Search bar functionality
- ✅ Filter panel structure
- ✅ Apply/Clear buttons
- ✅ API integration

**What Needs Fixing:**
- ❌ Too many filters (need to remove 5 filter types)
- ❌ Purpose options wrong (Fun → General Fitness)
- ❌ Training for Race too complex (should be simple toggle)
- ❌ Backend may not handle boolean trainingForRace filter

**MVP Goal:**
3 filters total: Location, Purpose, Training for Race (boolean)

