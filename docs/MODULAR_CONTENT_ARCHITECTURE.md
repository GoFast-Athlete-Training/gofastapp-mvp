# Modular Content Architecture

**Philosophy:** All content is API-driven. Each model type has a corresponding public container/renderer component.

---

## Architecture Pattern

```
API (GoFastCompany) → Returns Model Data → Public Container Component → Renders HTML
```

### Current Pattern

```
GET /api/content/website/hydrate?url=...
  ↓
Returns: { website, pages: [HomePage, ContentPage, ...] }
  ↓
Each page type has a Renderer:
  - HomePage → HomePageRenderer
  - ContentPage → ContentPageRenderer
  - RunClub → PublicRunClubContainer
```

---

## Page Types & Renderers

### 1. HomePage
**Model:** `HomePage`  
**Renderer:** `HomePageRenderer`  
**Location:** `components/HomePageRenderer.tsx`  
**Status:** ✅ Exists

**Fields:**
- title, subtitle, description
- heroImage
- ctaText, ctaHref
- showFeaturedRuns, featuredRunsCitySlug, featuredRunsLimit

---

### 2. ContentPage
**Model:** `ContentPage`  
**Renderer:** `ContentPageRenderer`  
**Location:** `components/ContentPageRenderer.tsx`  
**Status:** ✅ Exists

**Fields:**
- title, subhead, intro
- section1Title, section1Text, section1Photo, section1CtaText, section1CtaHref
- section2Title, section2Text, section2Photo, section2CtaText, section2CtaHref
- section3Title, section3Text, section3Photo, section3CtaText, section3CtaHref
- contentBlocks (flexible array)
- ctaText, ctaButtonLabel, ctaButtonHref

---

### 3. NavigationPage (NEW)
**Model:** `NavigationPage` (needs to be created)  
**Renderer:** `NavigationPageRenderer` (needs to be created)  
**Location:** `components/navigation/NavigationPageRenderer.tsx`  
**Status:** ❌ Needs Implementation

**Purpose:** City navigation page with cards for run clubs, businesses, etc.

**Schema Fields Needed:**
```prisma
model NavigationPage {
  id          String   @id @default(uuid())
  slug        String   // e.g., "dc", "boston"
  websiteId   String?
  
  // Page Content
  title       String   // e.g., "DC Running Life"
  description String?  // Paragraph about the city
  photo       Json?    // City photo
  
  // Navigation Cards Configuration
  cards       Json     // Array of card definitions
  
  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  website     Website? @relation(fields: [websiteId], references: [id])
  
  @@unique([websiteId, slug])
  @@map("navigation_pages")
}
```

**Card Definition Structure:**
```typescript
interface NavigationCard {
  id: string;                    // Unique ID
  type: 'run-club' | 'business' | 'other'; // Card type
  title: string;                 // Card title
  description: string;            // Card description
  icon: string;                  // Lucide icon name (e.g., "Users", "Building2")
  href: string;                  // Link destination
  imageUrl?: string;             // Optional card image
  count?: number;                // Optional count badge (e.g., "12 Run Clubs")
  color?: string;                // Optional color theme
}
```

**Example cards JSON:**
```json
{
  "cards": [
    {
      "id": "run-clubs",
      "type": "run-club",
      "title": "Run Clubs",
      "description": "Find local running clubs",
      "icon": "Users",
      "href": "/runclubs",
      "count": 12,
      "color": "purple"
    },
    {
      "id": "businesses",
      "type": "business",
      "title": "Running Businesses",
      "description": "Stores, gyms, and more",
      "icon": "Building2",
      "href": "/businesses",
      "count": 8,
      "color": "blue"
    }
  ]
}
```

---

### 4. TopicDetailPage (Generic)
**Model:** `TopicDetailPage` or reuse existing models  
**Renderer:** `TopicDetailRenderer`  
**Location:** `components/topic/TopicDetailRenderer.tsx`  
**Status:** ❌ Needs Implementation

**Purpose:** Generic detail page for run clubs, businesses, etc.

**Options:**
- **Option A:** Separate model per topic type (RunClub → PublicRunClubContainer)
- **Option B:** Generic TopicDetailPage model with type field
- **Recommendation:** Option A for now (already have RunClub detail)

---

## API Pattern

### Website Hydration API

**Endpoint:** `GET /api/content/website/hydrate?url=...`

**Returns:**
```typescript
{
  success: true,
  website: {
    id: string;
    name: string;
    url: string;
  },
  pages: [
    HomePage | ContentPage | NavigationPage | ...
  ]
}
```

**Current Implementation:**
- ✅ Fetches HomePage, ContentPage
- ❌ Needs to fetch NavigationPage
- ❌ Needs to fetch other page types

---

## Component Structure

### Renderer Components

All renderers follow this pattern:

```typescript
interface [PageType]RendererProps {
  page: [PageType];
}

export default function [PageType]Renderer({ page }: [PageType]RendererProps) {
  // Render page content
  return <div>...</div>;
}
```

### Public Container Components

For entity types (RunClub, Business, etc.):

```typescript
interface Public[Entity]ContainerProps {
  [entity]: [Entity];
}

export default function Public[Entity]Container({ [entity] }: Props) {
  // Render entity details
  return <div>...</div>;
}
```

---

## NavigationPage Implementation Plan

### Step 1: Database Schema

Add `NavigationPage` model to GoFastCompany:

```prisma
model NavigationPage {
  id          String   @id @default(uuid())
  slug        String
  websiteId   String?
  
  // Content
  title       String
  description String?
  photo       Json?    // { url, caption, alt, attributionText }
  
  // Cards Configuration
  cards       Json     // Array of NavigationCard objects
  
  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  website     Website? @relation(fields: [websiteId], references: [id], onDelete: SetNull)
  
  @@unique([websiteId, slug])
  @@index([websiteId])
  @@map("navigation_pages")
}
```

### Step 2: API Endpoint

Add to GoFastCompany API:

```typescript
// app/api/content/navigation-page/route.ts
export async function GET(request: NextRequest) {
  // Lookup NavigationPage by website URL and slug
  // Return NavigationPage data
}
```

Update hydration endpoint to include NavigationPage:

```typescript
// app/api/content/website/hydrate/route.ts
// Add navigationPages to response
```

### Step 3: Renderer Component

Create `NavigationPageRenderer`:

```typescript
// components/navigation/NavigationPageRenderer.tsx
import NavigationCard from './NavigationCard';
import { getIcon } from '@/lib/lucide-icons'; // Helper to get Lucide icon component

interface NavigationPage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  photo: PhotoObject | null;
  cards: NavigationCard[];
}

export default function NavigationPageRenderer({ page }: { page: NavigationPage }) {
  return (
    <div>
      {/* Hero Section */}
      <HeroSection title={page.title} description={page.description} photo={page.photo} />
      
      {/* Navigation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {page.cards.map(card => (
          <NavigationCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
```

### Step 4: NavigationCard Component

```typescript
// components/navigation/NavigationCard.tsx
import Link from 'next/link';
import { getIcon } from '@/lib/lucide-icons';

interface NavigationCardProps {
  card: NavigationCard;
}

export default function NavigationCard({ card }: NavigationCardProps) {
  const Icon = getIcon(card.icon); // Returns Lucide icon component
  
  return (
    <Link href={card.href} className="...">
      <div className="...">
        {Icon && <Icon className="..." />}
        <h3>{card.title}</h3>
        <p>{card.description}</p>
        {card.count && <span>{card.count}</span>}
      </div>
    </Link>
  );
}
```

### Step 5: Lucide Icon Helper

```typescript
// lib/lucide-icons.ts
import * as LucideIcons from 'lucide-react';

export function getIcon(iconName: string) {
  // Map icon name to Lucide component
  const IconComponent = (LucideIcons as any)[iconName];
  return IconComponent || null;
}
```

---

## Admin UI Components

### NavigationPage Form

**Location:** `GoFastCompany/components/navigation/NavigationPageForm.tsx`

**Features:**
- Title, description, photo fields
- **Card Builder:**
  - Add/remove cards
  - Card type selector (run-club, business, other)
  - Title, description inputs
  - **Lucide Icon Picker** (dropdown/search)
  - Href input
  - Optional: image URL, count, color

**Icon Picker Component:**
```typescript
// components/navigation/IconPicker.tsx
import { useState } from 'react';
import * as LucideIcons from 'lucide-react';

const ICON_NAMES = Object.keys(LucideIcons).filter(name => 
  name[0] === name[0].toUpperCase() && 
  typeof (LucideIcons as any)[name] === 'function'
);

export default function IconPicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  
  const filteredIcons = ICON_NAMES.filter(name =>
    name.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div>
      <input 
        type="text" 
        placeholder="Search icons..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="grid grid-cols-8 gap-2">
        {filteredIcons.map(iconName => {
          const Icon = (LucideIcons as any)[iconName];
          return (
            <button
              key={iconName}
              onClick={() => onChange(iconName)}
              className={value === iconName ? 'selected' : ''}
            >
              <Icon />
              <span>{iconName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Route Mapping

### Content Repo Routes

```
/ → HomePage (slug: "")
/[slug] → ContentPage or NavigationPage (lookup by slug)
/runclub/[slug] → PublicRunClubContainer (special route)
/runs → PublicRunsPage (special route)
/runs/[id] → RunDetailPage (special route)
```

**Route Resolution Logic:**
1. Check if slug matches special routes (`runclub/*`, `runs/*`)
2. Lookup NavigationPage by slug
3. Lookup ContentPage by slug
4. 404 if not found

---

## Benefits of This Architecture

✅ **Modular** - Each page type has its own renderer  
✅ **Reusable** - Works for any website  
✅ **API-Driven** - All content from API, no direct DB access  
✅ **Flexible** - Easy to add new page types  
✅ **Type-Safe** - TypeScript interfaces for each model  
✅ **Admin-Friendly** - Forms match model structure  

---

## Implementation Checklist

### Phase 1: NavigationPage Model
- [ ] Add NavigationPage to Prisma schema
- [ ] Create migration
- [ ] Add API endpoint `/api/content/navigation-page`
- [ ] Update hydration endpoint to include NavigationPage

### Phase 2: NavigationPage Renderer
- [ ] Create NavigationPageRenderer component
- [ ] Create NavigationCard component
- [ ] Create Lucide icon helper
- [ ] Add route handling in content repo

### Phase 3: Admin UI
- [ ] Create NavigationPageForm component
- [ ] Create IconPicker component
- [ ] Add to dashboard (create/edit pages)

### Phase 4: Integration
- [ ] Update route resolution logic
- [ ] Test with real data
- [ ] Add to website hydration

---

## Example: Complete Flow

```
1. Admin creates NavigationPage:
   - Slug: "dc"
   - Title: "DC Running Life"
   - Cards: [
       { type: "run-club", icon: "Users", href: "/runclubs" },
       { type: "business", icon: "Building2", href: "/businesses" }
     ]

2. User visits: dcruns.gofastcrushgoals.com/dc
   
3. Content repo:
   - Calls GET /api/content/navigation-page?url=...&slug=dc
   - Receives NavigationPage data
   - Renders with NavigationPageRenderer
   - Shows cards with Lucide icons

4. User clicks "Run Clubs" card
   - Navigates to /runclubs
   - Shows list of run clubs
```

---

## Future Page Types

- **EventPage** - Event listings
- **BlogPostPage** - Blog post detail
- **RoutePage** - Running route detail
- **RacePage** - Race event detail

Each follows the same pattern:
1. Model in database
2. API endpoint
3. Renderer component
4. Admin form

