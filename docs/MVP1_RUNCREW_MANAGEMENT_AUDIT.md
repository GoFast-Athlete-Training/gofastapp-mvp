# MVP1 RunCrew Management Features Audit

**Date**: January 2025  
**Purpose**: Audit and plan implementation for RunCrew management features

---

## Features to Implement

### 1. Add Member as Manager
**Status**: ❌ Not Implemented  
**Priority**: High

**Requirements:**
- Admin can promote a member to manager role
- Manager role exists in schema (`RunCrewRole.manager`)
- UI needed: Button/action in settings or admin page
- API endpoint needed: `PUT /api/runcrew/[id]/members/[membershipId]/role`

**Current State:**
- ✅ Schema supports `manager` role
- ❌ No UI to promote members
- ❌ No API endpoint to change roles
- ✅ Role checking exists (`membership.role === 'manager'`)

**Implementation Needed:**
- [ ] API endpoint: `PUT /api/runcrew/[id]/members/[membershipId]/role`
- [ ] UI: Promote to manager button in settings/members list
- [ ] Permission check: Only admin can promote
- [ ] Update membership role in database
- [ ] Refresh crew data after promotion

---

### 2. Transfer Ownership of RunCrew to Member
**Status**: ❌ Not Implemented  
**Priority**: High

**Requirements:**
- Admin can transfer ownership to another member
- Transferring ownership makes the new owner admin
- Old admin becomes regular member (or manager?)
- UI needed: Transfer ownership action in settings
- API endpoint needed: `POST /api/runcrew/[id]/transfer-ownership`

**Current State:**
- ✅ Schema supports role changes
- ❌ No UI for transfer ownership
- ❌ No API endpoint for transfer
- ❌ No ownership concept (just admin role)

**Questions to Resolve:**
- What happens to old admin? (Become member? Manager? Stay admin?)
- Can there be multiple admins? (Currently yes, but should ownership be unique?)
- Should we track "owner" separately from "admin"?

**Implementation Needed:**
- [ ] API endpoint: `POST /api/runcrew/[id]/transfer-ownership`
- [ ] UI: Transfer ownership button in settings (danger zone)
- [ ] Permission check: Only current admin can transfer
- [ ] Update roles: New owner → admin, Old admin → member/manager?
- [ ] Confirmation dialog (destructive action)
- [ ] Refresh crew data after transfer

---

### 3. Archive vs Delete RunCrew
**Status**: ❌ Not Implemented  
**Priority**: High

**Decision Needed**: Archive vs Delete

### Option A: Archive (Recommended)
**Pros:**
- ✅ Members can still view historical data (runs, messages, announcements)
- ✅ No data loss
- ✅ Can be unarchived if needed
- ✅ Preserves community history
- ✅ Members can still see their past activities

**Cons:**
- ⚠️ Takes up database space
- ⚠️ Need to handle archived crews in UI (filter out?)

**Behavior:**
- Archive crew → `isArchived = true`, `archivedAt = now()`
- Archived crews don't appear in active crew lists
- Members can still access archived crew (read-only)
- No new members can join
- No new runs/announcements/messages can be created
- Existing data preserved

### Option B: Delete
**Pros:**
- ✅ Clean removal
- ✅ Frees database space
- ✅ Simpler (no archive state to manage)

**Cons:**
- ❌ Permanent data loss
- ❌ Members lose access to history
- ❌ Cannot be undone
- ❌ Breaks references (if any)

**Recommendation**: **Archive** - Better UX, preserves history, reversible

---

## Current Schema Support

### RunCrewRole Enum
```prisma
enum RunCrewRole {
  member
  admin
  manager  // ← Exists but not used in UI
}
```

### RunCrew Model
```prisma
model RunCrew {
  isArchived Boolean   @default(false)  // ← Exists but not used
  archivedAt DateTime?                  // ← Exists but not used
  // ...
}
```

**Status**: ✅ Schema supports all features, just need to implement UI/API

---

## Implementation Plan

### Phase 1: Add Member as Manager

**API Endpoint:**
```typescript
// PUT /api/runcrew/[id]/members/[membershipId]/role
{
  role: 'manager' | 'member' | 'admin'
}
```

**UI Location:**
- Settings page: Members list with role dropdown/button
- Or: Admin page: Members list with promote action

**Flow:**
1. Admin clicks "Promote to Manager" on member
2. API call: `PUT /api/runcrew/[id]/members/[membershipId]/role` with `{ role: 'manager' }`
3. Verify admin permission
4. Update membership role
5. Return updated crew data
6. Refresh UI

---

### Phase 2: Transfer Ownership

**API Endpoint:**
```typescript
// POST /api/runcrew/[id]/transfer-ownership
{
  newOwnerMembershipId: string
}
```

**UI Location:**
- Settings page: Danger zone section
- Confirmation dialog required

**Flow:**
1. Admin selects member to transfer to
2. Confirmation dialog: "Transfer ownership to [Member Name]?"
3. API call: `POST /api/runcrew/[id]/transfer-ownership`
4. Verify current user is admin
5. Update roles:
   - New owner: `role = 'admin'`
   - Old admin: `role = 'member'` (or 'manager'?)
6. Return updated crew data
7. Refresh UI (may need to redirect if user is no longer admin)

**Edge Cases:**
- What if there are multiple admins? (Transfer to one, others become members?)
- Should old admin become manager or member?

---

### Phase 3: Archive RunCrew

**API Endpoint:**
```typescript
// POST /api/runcrew/[id]/archive
// POST /api/runcrew/[id]/unarchive (optional, for future)
```

**UI Location:**
- Settings page: Danger zone section
- Confirmation dialog required

**Flow:**
1. Admin clicks "Archive RunCrew"
2. Confirmation dialog: "Archive [Crew Name]? Members can still view history but no new activity."
3. API call: `POST /api/runcrew/[id]/archive`
4. Verify admin permission
5. Update: `isArchived = true`, `archivedAt = now()`
6. Return updated crew data
7. Show success message
8. Optionally redirect to welcome page

**UI Changes Needed:**
- Filter archived crews from active lists
- Show "Archived" badge if viewing archived crew
- Disable create actions (runs, announcements, messages)
- Show read-only message

---

## API Routes to Create

### 1. Update Member Role
**Route**: `PUT /api/runcrew/[id]/members/[membershipId]/role`  
**File**: `app/api/runcrew/[id]/members/[membershipId]/route.ts` (new)

**Request:**
```json
{
  "role": "manager" | "member" | "admin"
}
```

**Response:**
```json
{
  "success": true,
  "membership": { ... }
}
```

**Permissions:**
- Only admin can change roles
- Cannot demote yourself from admin (must transfer ownership first)

---

### 2. Transfer Ownership
**Route**: `POST /api/runcrew/[id]/transfer-ownership`  
**File**: `app/api/runcrew/[id]/transfer-ownership/route.ts` (new)

**Request:**
```json
{
  "newOwnerMembershipId": "clxxx..."
}
```

**Response:**
```json
{
  "success": true,
  "runCrew": { ... }
}
```

**Permissions:**
- Only current admin can transfer
- New owner must be existing member

---

### 3. Archive RunCrew
**Route**: `POST /api/runcrew/[id]/archive`  
**File**: `app/api/runcrew/[id]/archive/route.ts` (new)

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "runCrew": { ... }
}
```

**Permissions:**
- Only admin can archive
- Cannot archive if already archived

---

## UI Components Needed

### 1. Member Role Management
**Location**: Settings page, Members section

**Component**: `MemberRoleSelector` or inline buttons
- Show current role
- "Promote to Manager" button (if admin, member not manager)
- "Demote to Member" button (if admin, member is manager)
- Role dropdown (if multiple role changes needed)

---

### 2. Transfer Ownership
**Location**: Settings page, Danger zone

**Component**: Transfer ownership section
- Select member dropdown
- "Transfer Ownership" button
- Confirmation dialog

---

### 3. Archive RunCrew
**Location**: Settings page, Danger zone

**Component**: Archive section
- "Archive RunCrew" button
- Confirmation dialog with explanation
- Show archived status if already archived

---

## Questions to Resolve

### 1. Manager Role Permissions
- What can managers do that members can't?
- Can managers create runs/announcements? (Currently `canPostAnnouncements` checks for admin OR manager)
- Can managers promote other members?
- Can managers archive/delete?

**Recommendation**: Define manager permissions clearly before implementing.

---

### 2. Transfer Ownership Behavior
- What role does old admin get? (member? manager?)
- Can there be multiple admins? (Currently yes)
- Should we track "owner" separately? (Probably not for MVP1)

**Recommendation**: 
- Old admin becomes `member` (simplest)
- Keep multiple admins possible (current behavior)
- Don't track owner separately (just use admin role)

---

### 3. Archive vs Delete
- **Decision**: **Archive** (recommended)
- Why: Preserves history, reversible, better UX
- Implementation: Use existing `isArchived` and `archivedAt` fields

---

## Implementation Checklist

### Add Member as Manager
- [ ] Create API endpoint: `PUT /api/runcrew/[id]/members/[membershipId]/role`
- [ ] Add UI: Promote to manager button in settings
- [ ] Add permission check (admin only)
- [ ] Test role change
- [ ] Update UI after role change

### Transfer Ownership
- [ ] Create API endpoint: `POST /api/runcrew/[id]/transfer-ownership`
- [ ] Add UI: Transfer ownership in settings danger zone
- [ ] Add confirmation dialog
- [ ] Handle old admin role change
- [ ] Test transfer flow
- [ ] Handle redirect if user is no longer admin

### Archive RunCrew
- [ ] Create API endpoint: `POST /api/runcrew/[id]/archive`
- [ ] Add UI: Archive button in settings danger zone
- [ ] Add confirmation dialog with explanation
- [ ] Update crew filtering (exclude archived from lists)
- [ ] Add read-only UI for archived crews
- [ ] Disable create actions for archived crews
- [ ] Test archive flow

---

## Priority Order

1. **Archive RunCrew** (Highest)
   - Most requested feature
   - Preserves data
   - Clear use case

2. **Add Member as Manager** (High)
   - Enables delegation
   - Uses existing schema
   - Clear permissions

3. **Transfer Ownership** (High)
   - Important for crew continuity
   - May need to clarify behavior first

---

## Notes

- All features use existing schema (no migrations needed)
- All features require admin permissions
- All features should refresh crew data after action
- All features should show success/error toasts
- Archive is recommended over delete (better UX, reversible)

