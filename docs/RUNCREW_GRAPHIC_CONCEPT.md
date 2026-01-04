# RunCrew Graphic Concept

**Date**: January 2025  
**Purpose**: Define the unified "RunCrew Graphic" concept that replaces separate logo/icon fields

---

## 🎯 Core Concept

**"RunCrew Graphic"** is the universal term for the visual identity of a RunCrew. It can be either:
- An **emoji icon** (single character, e.g., 🏃, 🏔️, 🎯)
- A **logo image** (uploaded file)

**Key Principle**: One visual identity, two ways to set it. They are **interchangeable**, not separate concepts.

---

## 📋 User Flow

### During Creation
1. User creates a RunCrew
2. User **chooses an emoji icon** (required)
3. This emoji becomes the **RunCrew Graphic**
4. The emoji is stored in the `icon` field

### After Creation (Settings Page)
1. User sees "RunCrew Graphic" field
2. Field displays:
   - **If logo exists**: Shows the logo image
   - **If no logo but icon exists**: Shows the emoji icon
   - **If neither**: Shows placeholder "No graphic set"

3. User can:
   - **Upload a logo image** → Replaces the emoji, logo becomes the graphic
   - **Change the emoji** → If no logo, updates the icon; if logo exists, user must remove logo first
   - **Remove logo** → Falls back to emoji icon (if exists)

---

## 🔄 Fork Logic

When user wants to change the graphic:

### Scenario 1: Currently using emoji icon
- User can:
  - Upload logo → Logo replaces emoji
  - Change emoji → Updates icon directly

### Scenario 2: Currently using logo
- User can:
  - Remove logo → Falls back to emoji (if exists)
  - Change emoji → Only works if logo is removed first (or show message: "Remove logo to change emoji")

### Scenario 3: No graphic set
- User can:
  - Upload logo → Sets logo
  - Set emoji → Sets icon

---

## 🎨 UI/UX Design

### Single Field: "RunCrew Graphic"
- **Label**: "RunCrew Graphic" (universal term)
- **Display**: Shows current graphic (logo OR emoji)
- **Input**: 
  - File upload for logo
  - Emoji input (if no logo, or after removing logo)
- **Help Text**: "Upload a logo image or set an emoji icon"

### Visual Display
```
┌─────────────────────────────────────┐
│ RunCrew Graphic                      │
│                                      │
│ [Logo Image or Emoji Display]       │
│                                      │
│ [Choose File] [No file chosen]      │
│ or                                   │
│ [Emoji Input: 🏃]                    │
│                                      │
│ Upload a logo image or set an emoji  │
└─────────────────────────────────────┘
```

---

## 💾 Data Model

### Database Fields
- `icon`: String (emoji character, 1-2 chars) - nullable
- `logo`: String (URL to uploaded image) - nullable

### Display Logic
```typescript
const runCrewGraphic = crew.logo || crew.icon || null;

// Display priority:
// 1. Logo (if exists)
// 2. Icon/Emoji (if exists)
// 3. Placeholder (if neither)
```

### Save Logic
- **Uploading logo**: Sets `logo` field, can optionally clear `icon`
- **Setting emoji**: Sets `icon` field, only if `logo` is null (or user removes logo first)
- **Removing logo**: Sets `logo` to null, falls back to `icon`

---

## 🚫 What We're NOT Doing

1. ❌ **Separate fields** - No "Logo" field and "Icon" field
2. ❌ **"Fallback" language** - Not "icon is fallback for logo"
3. ❌ **Hierarchical thinking** - Not "logo is primary, icon is secondary"
4. ❌ **Complex UI** - Not two separate sections

---

## ✅ What We ARE Doing

1. ✅ **Unified concept** - "RunCrew Graphic" (one thing, two forms)
2. ✅ **Interchangeable** - Logo and emoji are equal options
3. ✅ **Simple UX** - One field, clear options
4. ✅ **Creation flow** - Start with emoji, can upgrade to logo
5. ✅ **Fork logic** - Clear path to change between logo/emoji

---

## 📝 Implementation Notes

### Settings Page
- Single "RunCrew Graphic" section
- Shows current graphic (logo or emoji)
- File upload + emoji input in same area
- Clear messaging about interchangeability

### Creation Page
- Emoji picker (required)
- Sets `icon` field
- Can optionally upload logo instead (skips emoji)

### Display Throughout App
- Always use: `crew.logo || crew.icon`
- Never say "logo or icon" - just show the graphic
- Consistent terminology: "RunCrew Graphic"

---

## 🎯 Benefits

1. **Simpler mental model** - One graphic, not two things
2. **Better UX** - Less confusion about logo vs icon
3. **Flexible** - Users can start simple (emoji) and upgrade (logo)
4. **Consistent** - Same term everywhere: "RunCrew Graphic"
5. **Clear** - No ambiguity about what to show

---

## 🔄 Migration Path

### Current State
- Separate "Logo" and "Icon" fields
- "Icon (Emoji) - Fallback if no logo" language
- Two separate inputs

### Target State
- Single "RunCrew Graphic" field
- Unified display and input
- Clear interchangeability messaging

### Steps
1. Update Settings page UI
2. Update Creation page to use "RunCrew Graphic"
3. Update all display logic to use `logo || icon`
4. Update all labels/help text
5. Test fork logic (logo ↔ emoji)

---

## ✅ Acceptance Criteria

- [ ] Settings page shows single "RunCrew Graphic" field
- [ ] Field displays logo OR emoji (whichever exists)
- [ ] User can upload logo (replaces emoji)
- [ ] User can set emoji (if no logo)
- [ ] User can remove logo (falls back to emoji)
- [ ] Creation page uses "RunCrew Graphic" terminology
- [ ] All help text uses "graphic" not "logo/icon"
- [ ] Display logic: `logo || icon` everywhere
- [ ] No "fallback" language anywhere

