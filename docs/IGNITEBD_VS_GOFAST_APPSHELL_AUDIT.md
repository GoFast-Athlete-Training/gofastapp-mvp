# IgniteBd vs GoFast AppShell Pattern Audit

## Key Difference: Global AppShell vs Page-Level Layout

### IgniteBd Pattern (✅ Works Correctly)

**Structure:**
```
app/
  layout.js → Providers → AppShell (global wrapper)
    ├── Navigation (top bar, sticky)
    ├── CompanyHQContextHeader (conditional)
    ├── Sidebar (conditional, fixed left, w-64)
    └── main (ml-64 when sidebar shown)
```

**How it works:**
1. **AppShell** is in `components/AppShell.jsx` - wraps ALL authenticated pages
2. **AppShell** is imported in `app/providers.jsx` and wraps children
3. **Sidebar** is conditionally shown based on `ROUTES_WITH_SIDEBAR` array
4. **Pages** are simple - they just render content, no layout concerns
5. **Sidebar** is fixed (`fixed left-0 top-14`) with `w-64`
6. **Main content** gets `ml-64` margin when sidebar is visible

**Example page (growth-dashboard):**
```jsx
// Just renders content - no layout code
export default function GrowthDashboardPageContent() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Content only */}
      </div>
    </div>
  );
}
```

**Settings page:**
```jsx
// Settings page has NO sidebar code
// It just renders cards/forms
// AppShell handles sidebar globally
```

---

### GoFast Current Pattern (❌ Problematic)

**Structure:**
```
app/
  layout.tsx → ClientProviders (no AppShell)
    └── pages (each manages own layout)
      └── settings/page.tsx → SettingsAppShell (custom sidebar)
```

**Problems:**
1. **No global AppShell** - each page manages its own layout
2. **SettingsAppShell** creates sidebar INSIDE the page component
3. **Fighting with global layout** - sidebar is nested, not fixed
4. **Inconsistent** - other pages don't have this pattern
5. **Layout conflicts** - `min-h-screen` on both outer and inner divs

**Current settings page:**
```tsx
// SettingsAppShell creates its own sidebar
<div className="min-h-screen bg-gray-50">
  <div className="flex">
    <aside className="w-64 ..."> {/* Not fixed */}
      {/* Sidebar */}
    </aside>
    <main className="flex-1">
      {/* Content */}
    </main>
  </div>
</div>
```

---

## Solution: Match IgniteBd Pattern

### Step 1: Create Global AppShell (like IgniteBd)

**Create `components/AppShell.tsx`:**
```tsx
'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import TopNav from '@/components/shared/TopNav';

const ROUTES_WITH_SIDEBAR = [
  '/runcrew/[runCrewId]/settings', // Settings pages
  // Add other routes that need sidebar
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  const showSidebar = useMemo(() => {
    if (!pathname) return false;
    return ROUTES_WITH_SIDEBAR.some((route) => {
      // Handle dynamic routes
      if (route.includes('[')) {
        const pattern = route.replace(/\[.*?\]/g, '[^/]+');
        return new RegExp(`^${pattern}`).test(pathname);
      }
      return pathname.startsWith(route);
    });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      
      {showSidebar && (
        <Suspense fallback={<div className="w-64" />}>
          {/* Sidebar will be rendered by page */}
        </Suspense>
      )}
      
      <main className={showSidebar ? 'ml-64 min-h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-3.5rem)]'}>
        {children}
      </main>
    </div>
  );
}
```

### Step 2: Refactor Settings Page

**Remove SettingsAppShell wrapper, use simple layout:**

```tsx
export default function RunCrewSettingsPage() {
  // ... state and logic ...
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Return buttons */}
      <header className="bg-white border-b border-gray-200 sticky top-14 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {crewGraphic}
              <div>
                <h1 className="text-xl font-bold">{crew.runCrewBaseInfo?.name}</h1>
                <p className="text-sm text-gray-500">Settings</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/runcrew/${runCrewId}/admin`}>
                Return as Manager
              </Link>
              <Link href={`/runcrew/${runCrewId}/member`}>
                Return as Member
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Fixed Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 fixed left-0 top-[calc(3.5rem+4rem)] h-[calc(100vh-3.5rem-4rem)] overflow-y-auto">
          <nav className="p-4">
            {/* Navigation items */}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64">
          <div className="p-8">
            {renderSectionContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
```

### Step 3: Key Differences to Fix

1. **Sidebar positioning:**
   - ❌ Current: `relative` inside flex container
   - ✅ Should be: `fixed left-0` with proper top offset

2. **Main content margin:**
   - ❌ Current: `flex-1` (no margin)
   - ✅ Should be: `ml-64` (margin for fixed sidebar)

3. **Header:**
   - ❌ Current: Inside SettingsAppShell
   - ✅ Should be: Separate header with return buttons, sticky top

4. **Layout structure:**
   - ❌ Current: Nested `min-h-screen` divs
   - ✅ Should be: Single outer container, fixed sidebar, margined main

---

## Implementation Checklist

- [ ] Create global AppShell component (optional - can keep page-level for now)
- [ ] Fix sidebar to be `fixed` not `relative`
- [ ] Add `ml-64` to main content when sidebar is visible
- [ ] Add header with "Return as Member/Manager" buttons
- [ ] Remove nested `min-h-screen` divs
- [ ] Test layout doesn't break on different screen sizes

