# Discovery Page Refactor Plan

**Date:** January 2025  
**Goal:** Mirror invite flow - cards with "Join this Crew" button that does membership mutation

---

## Current Discovery Page

**Route:** `/runcrew`  
**File:** `/app/runcrew/page.tsx`

**Current Behavior:**
- Shows grid of RunCrew cards
- Each card is a `<Link>` to `/runcrew/${crew.id}` (member container)
- Button says "View Details" (just styling, not a button)
- No join action - just navigation
- Requires authentication (uses `api.get()`)

**Link to current page:** `https://your-domain.com/runcrew`

---

## Invite Flow (What We're Mirroring)

**Route:** `/join/runcrew/[handle]`  
**File:** `/app/join/runcrew/[handle]/page.tsx`

**Key Features:**
1. **Expandable Details** - "Click for more details" button shows:
   - Full description
   - Leader profile card with bio
2. **Join Button** - "Join this Crew" that:
   - If not authenticated → `/join/runcrew/[handle]/signup`
   - If authenticated → Shows confirmation UI → Calls `/api/runcrew/join`
3. **Membership Mutation** - Actually creates membership via API

---

## What Needs to Change

### 1. Cards Should Have Join Action (Not Just Link)

**Current:**
```tsx
<Link href={`/runcrew/${crew.id}`}>
  <div className="bg-blue-500">View Details</div>
</Link>
```

**New:**
```tsx
<div className="card">
  {/* Card content */}
  <button onClick={() => handleJoinClick(crew)}>
    Join this Crew
  </button>
</div>
```

### 2. Add Expandable Details (Like Invite Flow)

**Current:** Shows limited info (description truncated with `line-clamp-2`)

**New:** Add "Click for more details" button that expands to show:
- Full description
- Leader info (if available from API)
- All details

### 3. Handle Join Action

**Flow:**
```
User clicks "Join this Crew" on card
  ↓
Check if authenticated
  ↓
┌─────────────────────┬─────────────────────┐
│ NOT AUTHENTICATED   │ AUTHENTICATED       │
└─────────────────────┴─────────────────────┘
         ↓                        ↓
Store join intent      Show confirmation modal
Redirect to signup     (same as invite flow)
         ↓                        ↓
After signup → return  User confirms → Join API
```

### 4. Use Handles Instead of IDs

**Current:** Links use internal IDs (`/runcrew/${crew.id}`)

**New:** Use handles for public URLs (`/join/runcrew/${crew.handle}`)

---

## Implementation Plan

### Step 1: Update API Response
- ✅ Add `handle` to discover API response (already done)
- [ ] Add `leader` info to discover API response (for details expansion)

### Step 2: Refactor Card Component
- [ ] Remove `<Link>` wrapper
- [ ] Add expandable details section (like invite flow)
- [ ] Add "Join this Crew" button
- [ ] Add join handler function

### Step 3: Add Join Logic
- [ ] Check authentication state
- [ ] Store join intent in localStorage (if not authenticated)
- [ ] Show confirmation modal (if authenticated)
- [ ] Call `/api/runcrew/join` API
- [ ] Handle redirects

### Step 4: Make Public
- [ ] Replace `api.get()` with `fetch()` for public access
- [ ] Remove or conditionally show TopNav
- [ ] Test without authentication

---

## Code Structure

### Card Component (New)
```tsx
function RunCrewCard({ crew }: { crew: DiscoverableRunCrew }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleJoinClick = () => {
    if (!isAuthenticated) {
      // Store join intent
      localStorage.setItem('runCrewJoinIntent', crew.id);
      localStorage.setItem('runCrewJoinIntentHandle', crew.handle);
      // Redirect to signup
      router.push(`/join/runcrew/${crew.handle}/signup`);
    } else {
      // Show confirmation modal
      setShowJoinModal(true);
    }
  };

  const handleConfirmJoin = async () => {
    // Call join API
    await api.post('/runcrew/join', { crewId: crew.id });
    // Redirect to success
  };

  return (
    <div className="card">
      {/* Card header */}
      {/* Basic info */}
      
      {/* Expandable details */}
      {crew.description && (
        <>
          <button onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Hide details' : 'Click for more details'}
          </button>
          {showDetails && (
            <div>
              <p>{crew.description}</p>
              {crew.leader && <LeaderCard leader={crew.leader} />}
            </div>
          )}
        </>
      )}
      
      {/* Join button */}
      <button onClick={handleJoinClick}>
        Join this Crew
      </button>
      
      {/* Join confirmation modal */}
      {showJoinModal && (
        <JoinConfirmationModal
          crew={crew}
          onConfirm={handleConfirmJoin}
          onCancel={() => setShowJoinModal(false)}
        />
      )}
    </div>
  );
}
```

---

## Questions

1. **Leader Info:** Does discover API return leader info? Need to check.
2. **Modal vs Inline:** Should confirmation be a modal or inline UI (like invite flow)?
3. **Public Access:** Should we make the whole page public or keep it authenticated?
4. **Route:** Keep `/runcrew` or create new `/groups` route?

---

## Next Steps

1. Check if discover API returns leader info
2. Create card component with expandable details
3. Add join button and handler
4. Test join flow
5. Make public (if desired)

