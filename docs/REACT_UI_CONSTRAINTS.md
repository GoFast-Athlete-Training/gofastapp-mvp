# React UI Constraints - GoFast MVP

**Last Updated**: January 2025  
**Purpose**: Prevent layout overflow, text falling off page, and layout drift issues

---

## 🚨 Core Principles

### 1. Always Constrain Width
**Never let content run unbounded horizontally.**

```tsx
// ❌ WRONG - Content can run off page
<main className="flex-1">
  <div className="p-8">
    {children}
  </div>
</main>

// ✅ CORRECT - Constrained width
<main className="flex-1 ml-64 min-w-0">
  <div className="max-w-4xl mx-auto p-8">
    {children}
  </div>
</main>
```

**Rules:**
- Main content areas MUST have `max-w-*` constraint (`max-w-4xl`, `max-w-7xl`, etc.)
- Use `mx-auto` to center constrained content
- Never use `w-full` without a parent constraint

---

### 2. Flex Children Must Shrink
**Flex children need `min-w-0` to allow proper shrinking.**

```tsx
// ❌ WRONG - Flex child can't shrink, causes overflow
<div className="flex">
  <div className="flex-1">
    <input className="w-full" />
  </div>
</div>

// ✅ CORRECT - Allows shrinking
<div className="flex">
  <div className="flex-1 min-w-0">
    <input className="w-full min-w-0" />
  </div>
</div>
```

**Rules:**
- All flex children that contain text/inputs MUST have `min-w-0`
- Inputs, textareas, and text containers in flex layouts need `min-w-0`
- This tells the browser: "You're allowed to shrink below your content width"

---

### 3. Fixed Sidebars Need Proper Margins
**When using fixed sidebars, main content needs margin compensation.**

```tsx
// ❌ WRONG - Content hidden behind fixed sidebar
<aside className="fixed left-0 w-64">...</aside>
<main className="flex-1">
  {/* Content hidden behind sidebar */}
</main>

// ✅ CORRECT - Margin compensates for fixed sidebar
<aside className="fixed left-0 w-64">...</aside>
<main className="flex-1 ml-64 min-w-0">
  {/* Content properly offset */}
</main>
```

**Rules:**
- Fixed sidebar: `fixed left-0 top-[offset] w-64`
- Main content: `ml-64` (margin-left = sidebar width)
- Main content: `min-w-0` (allows shrinking)

---

### 4. Global Overflow Prevention
**Global CSS must prevent horizontal overflow at the root level.**

```css
/* ✅ REQUIRED in globals.css */
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 100vw; /* Prevent exceeding viewport */
  overflow-x: hidden; /* Hide horizontal scroll */
}

body {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden; /* Double-check body */
}

/* Prevent any element from causing overflow */
* {
  max-width: 100%; /* All elements respect viewport */
}

/* Ensure flex children can shrink */
.flex > * {
  min-width: 0;
}
```

---

## 📐 Layout Patterns

### Pattern 1: Page with Fixed Sidebar (Settings Page)

```tsx
export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Sticky */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Header content */}
        </div>
      </header>

      <div className="flex">
        {/* Fixed Sidebar */}
        <aside className="w-64 bg-white border-r fixed left-0 top-[4rem] h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="p-4">
            {/* Navigation */}
          </nav>
        </aside>

        {/* Main Content - WITH margin and constraint */}
        <main className="flex-1 ml-64 min-w-0">
          <div className="max-w-4xl mx-auto p-8">
            {/* Page content */}
          </div>
        </main>
      </div>
    </div>
  );
}
```

**Key Points:**
- Sidebar: `fixed left-0 top-[header-height]`
- Main: `ml-64` (sidebar width)
- Main: `min-w-0` (allows shrinking)
- Content wrapper: `max-w-4xl mx-auto` (constrains width)

---

### Pattern 2: Standard Page (No Sidebar)

```tsx
export default function StandardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Header content */}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Page content - constrained and centered */}
      </main>
    </div>
  );
}
```

**Key Points:**
- Header: `max-w-7xl mx-auto` (matches main width)
- Main: `max-w-7xl mx-auto` (constrained width)
- No sidebar = no margin needed

---

### Pattern 3: Form Inputs in Flex Layouts

```tsx
// ❌ WRONG - Input can overflow
<div className="flex items-center gap-4">
  <div className="flex-1">
    <input className="w-full" />
  </div>
  <button>Save</button>
</div>

// ✅ CORRECT - Input can shrink
<div className="flex items-center gap-4">
  <div className="flex-1 min-w-0">
    <input className="w-full min-w-0" />
  </div>
  <button className="flex-shrink-0">Save</button>
</div>
```

**Key Points:**
- Flex parent: `flex-1 min-w-0` (allows shrinking)
- Input: `w-full min-w-0` (respects parent, can shrink)
- Button: `flex-shrink-0` (never shrinks)

---

## 🎯 Component-Specific Rules

### Inputs & Textareas

```tsx
// ✅ ALWAYS include min-w-0 in flex contexts
<input
  className="w-full min-w-0 px-4 py-2 border rounded-lg"
  // ... props
/>

<textarea
  className="w-full min-w-0 px-4 py-2 border rounded-lg resize-y"
  // ... props
/>
```

**Rules:**
- `w-full` - Takes full width of parent
- `min-w-0` - Can shrink below content width (critical in flex)
- Never use `flex-1` on inputs directly

---

### Text Containers

```tsx
// ✅ Text that might overflow
<div className="flex-1 min-w-0">
  <p className="truncate">Long text that might overflow</p>
</div>

// ✅ Text with line clamping
<div className="flex-1 min-w-0">
  <p className="line-clamp-2">Long text that might overflow</p>
</div>
```

**Rules:**
- Text containers in flex: `min-w-0`
- Use `truncate` or `line-clamp-*` for overflow text
- Never let text push container beyond viewport

---

### Buttons in Flex Layouts

```tsx
// ✅ Buttons should not shrink
<div className="flex items-center gap-4">
  <div className="flex-1 min-w-0">
    <input />
  </div>
  <button className="flex-shrink-0 whitespace-nowrap">
    Save
  </button>
</div>
```

**Rules:**
- Buttons: `flex-shrink-0` (never shrink)
- Buttons: `whitespace-nowrap` (prevent text wrapping)

---

## 🔍 Common Mistakes

### Mistake 1: Unconstrained Main Content

```tsx
// ❌ WRONG
<main className="flex-1">
  <div className="p-8">
    {/* Content can run off page */}
  </div>
</main>

// ✅ CORRECT
<main className="flex-1 ml-64 min-w-0">
  <div className="max-w-4xl mx-auto p-8">
    {/* Content constrained */}
  </div>
</main>
```

---

### Mistake 2: Missing min-w-0 on Flex Children

```tsx
// ❌ WRONG - Input can't shrink
<div className="flex">
  <input className="flex-1" />
</div>

// ✅ CORRECT - Input can shrink
<div className="flex">
  <input className="flex-1 min-w-0" />
</div>
```

---

### Mistake 3: Fixed Sidebar Without Margin

```tsx
// ❌ WRONG - Content hidden
<aside className="fixed left-0 w-64">...</aside>
<main className="flex-1">
  {/* Hidden behind sidebar */}
</main>

// ✅ CORRECT - Content offset
<aside className="fixed left-0 w-64">...</aside>
<main className="flex-1 ml-64 min-w-0">
  {/* Properly offset */}
</main>
```

---

### Mistake 4: Nested min-h-screen

```tsx
// ❌ WRONG - Nested full-height containers
<div className="min-h-screen">
  <div className="min-h-screen">
    {/* Causes layout issues */}
  </div>
</div>

// ✅ CORRECT - Single full-height container
<div className="min-h-screen">
  <div>
    {/* Content */}
  </div>
</div>
```

---

## ✅ Checklist for New Pages

When creating a new page, ensure:

- [ ] Main content has `max-w-*` constraint (`max-w-4xl`, `max-w-7xl`)
- [ ] Main content has `mx-auto` for centering
- [ ] If using fixed sidebar, main has `ml-64` (or appropriate margin)
- [ ] Main element has `min-w-0` if in flex layout
- [ ] All flex children with text/inputs have `min-w-0`
- [ ] Inputs/textareas have `min-w-0` in flex contexts
- [ ] Buttons have `flex-shrink-0` if in flex layouts
- [ ] No nested `min-h-screen` divs
- [ ] Global CSS includes overflow prevention rules

---

## 📚 Reference: IgniteBd Pattern

**IgniteBd's AppShell pattern (working correctly):**

```tsx
// AppShell.jsx
export default function AppShell({ children }) {
  const showSidebar = useMemo(() => {
    return ROUTES_WITH_SIDEBAR.some((route) => pathname.startsWith(route));
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      {showSidebar && <Sidebar />}
      <main className={showSidebar ? 'flex-1 ml-64 min-h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-3.5rem)]'}>
        {children}
      </main>
    </div>
  );
}
```

**Key takeaways:**
- Sidebar is fixed (`fixed left-0 top-14`)
- Main has conditional `ml-64` when sidebar shown
- Main has proper height calculation
- Pages are simple - just render content, no layout code

---

## 🎨 Tailwind Classes Reference

### Width Constraints
- `max-w-4xl` - Constrain to 896px (good for content)
- `max-w-7xl` - Constrain to 1280px (good for headers)
- `mx-auto` - Center horizontally
- `w-full` - Full width (use with parent constraint)

### Flex Shrinking
- `min-w-0` - Allow flex child to shrink below content width
- `flex-shrink-0` - Prevent flex child from shrinking
- `flex-1` - Grow to fill space (needs `min-w-0` if contains text)

### Overflow
- `overflow-x-hidden` - Hide horizontal scroll
- `truncate` - Ellipsis for single-line overflow
- `line-clamp-2` - Ellipsis for multi-line overflow (2 lines)

### Positioning
- `fixed left-0` - Fixed sidebar positioning
- `sticky top-0` - Sticky header
- `ml-64` - Margin for 256px (w-64) sidebar

---

## 🚀 Quick Fixes

### If text is falling off page:
1. Add `max-w-4xl mx-auto` to main content wrapper
2. Add `min-w-0` to flex children with text
3. Check global CSS has overflow prevention

### If content hidden behind sidebar:
1. Add `ml-64` to main content (or appropriate margin)
2. Ensure sidebar is `fixed`, not `relative`

### If inputs overflowing:
1. Add `min-w-0` to input and parent flex container
2. Ensure parent has width constraint

---

**Remember**: These constraints prevent the "text falling off page" issue that plagued the settings page. Always apply them proactively, not reactively.

