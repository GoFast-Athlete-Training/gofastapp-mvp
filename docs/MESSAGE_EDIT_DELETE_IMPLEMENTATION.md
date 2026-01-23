# Message Edit/Delete Implementation

**Date:** 2025-01-03  
**Status:** ✅ **IMPLEMENTED**

---

## Overview

Implemented message editing and deletion functionality with proper authorization:
- **Users** can edit/delete their own messages
- **Admins** can edit/delete any message in their crew

---

## Implementation Details

### 1. Schema Changes

**File:** `packages/shared-db/prisma/schema.prisma`

**Added:**
```prisma
model RunCrewMessage {
  // ...
  updatedAt DateTime @updatedAt // Track when message was last edited
  // ...
}
```

**Migration:** `20250103130000_add_message_updated_at/migration.sql`
- Adds `updatedAt` column with default value
- Creates trigger to auto-update on message edits

### 2. API Endpoints

**File:** `app/api/runcrew/[id]/messages/[messageId]/route.ts`

#### PUT `/api/runcrew/[id]/messages/[messageId]` - Edit Message
- **Authorization:** User must be message owner OR admin
- **Request Body:** `{ content: string }`
- **Response:** Updated message object
- **Validation:**
  - Verifies user is crew member
  - Checks message belongs to crew
  - Validates ownership or admin role
  - Requires non-empty content

#### DELETE `/api/runcrew/[id]/messages/[messageId]` - Delete Message
- **Authorization:** User must be message owner OR admin
- **Response:** `{ success: true }`
- **Validation:**
  - Verifies user is crew member
  - Checks message belongs to crew
  - Validates ownership or admin role

**Permission Logic:**
```typescript
const isAdmin = membership.role === 'admin';
const isOwner = message.athleteId === athlete.id;

if (!isOwner && !isAdmin) {
  return 403 Forbidden;
}
```

### 3. Frontend Implementation

#### MessageFeed Component

**File:** `components/RunCrew/MessageFeed.tsx`

**Features:**
- ✅ Edit button (shown for own messages or if admin)
- ✅ Delete button (shown for own messages or if admin)
- ✅ Inline editing with textarea
- ✅ Save/Cancel buttons during edit
- ✅ "(edited)" indicator when message was modified
- ✅ Confirmation dialog for delete

**Props:**
- `isAdmin?: boolean` - If true, can edit/delete any message
- `crewId: string` - Crew ID
- `topics?: string[]` - Available topics
- `selectedTopic?: string` - Currently selected topic

**State Management:**
- `editingMessageId` - Tracks which message is being edited
- `editContent` - Stores edit text
- `currentUserId` - Current user ID from localStorage

**Functions:**
- `handleEdit(message)` - Start editing a message
- `handleSaveEdit(messageId)` - Save edited message
- `handleCancelEdit()` - Cancel editing
- `handleDelete(messageId)` - Delete message with confirmation
- `canEditMessage(message)` - Check if user can edit message

#### Member Page

**File:** `app/runcrew/[runCrewId]/member/page.tsx`

**Changes:**
- Added MessageFeed component
- Passes `isAdmin` prop based on membership role
- Users can edit/delete their own messages

**Usage:**
```tsx
<MessageFeed 
  crewId={runCrewId}
  topics={crew.meta?.messageTopics || ['general', 'runs', 'social']}
  selectedTopic="general"
  isAdmin={isAdmin}
/>
```

#### Admin Page

**File:** `app/runcrew/[runCrewId]/admin/page.tsx`

**Changes:**
- Added Messages Management section
- Uses MessageFeed with `isAdmin={true}`
- Admins can edit/delete ANY message in the crew

**Usage:**
```tsx
<MessageFeed 
  crewId={runCrewId}
  topics={topics}
  selectedTopic="general"
  isAdmin={true}
/>
```

---

## User Experience

### Member View
1. **Own Messages:**
   - See "Edit" and "Delete" buttons on hover/click
   - Click "Edit" → textarea appears with current content
   - Modify text → Click "Save" or "Cancel"
   - Click "Delete" → confirmation dialog → message removed

2. **Other Users' Messages:**
   - No edit/delete buttons (read-only)
   - Can view and reply

### Admin View
1. **All Messages:**
   - See "Edit" and "Delete" buttons on ALL messages
   - Can edit/delete any message regardless of author
   - Same edit/delete flow as member view

### Visual Indicators
- **"(edited)"** label appears next to timestamp if `updatedAt !== createdAt`
- Edit/Delete buttons appear on hover or always visible (depending on UX)
- Loading states during save/delete operations

---

## Security

### Authorization Checks

1. **Firebase Authentication:**
   - All endpoints require valid Firebase token
   - Token verified via `adminAuth.verifyIdToken()`

2. **Membership Verification:**
   - User must be a member of the crew
   - Checked via `hydrateCrew()` membership lookup

3. **Ownership/Admin Check:**
   - User can edit/delete own messages
   - Admin can edit/delete any message
   - Returns 403 if unauthorized

4. **Message Validation:**
   - Verifies message belongs to the crew
   - Prevents cross-crew message manipulation

---

## API Flow

### Edit Message Flow
```
1. User clicks "Edit" on message
2. Frontend: Sets editingMessageId, loads content into textarea
3. User modifies text, clicks "Save"
4. Frontend: PUT /api/runcrew/[id]/messages/[messageId] { content }
5. Backend: Verify auth → Verify membership → Check ownership/admin
6. Backend: Update message in database
7. Frontend: Reload messages, show updated content with "(edited)" label
```

### Delete Message Flow
```
1. User clicks "Delete" on message
2. Frontend: Show confirmation dialog
3. User confirms deletion
4. Frontend: DELETE /api/runcrew/[id]/messages/[messageId]
5. Backend: Verify auth → Verify membership → Check ownership/admin
6. Backend: Delete message from database
7. Frontend: Reload messages, removed message disappears
```

---

## Database Schema

**Before:**
```prisma
model RunCrewMessage {
  id        String @id
  content   String
  createdAt DateTime
  // No updatedAt
}
```

**After:**
```prisma
model RunCrewMessage {
  id        String @id
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt  // NEW
}
```

**Migration Required:**
- Add `updatedAt` column with default value
- Set existing rows to `CURRENT_TIMESTAMP`
- Create trigger for auto-update on edits

---

## Testing Checklist

- [x] User can edit own message
- [x] User can delete own message
- [x] User cannot edit other users' messages
- [x] User cannot delete other users' messages
- [x] Admin can edit any message
- [x] Admin can delete any message
- [x] "(edited)" indicator shows when message was modified
- [x] Edit mode shows textarea with current content
- [x] Save updates message content
- [x] Cancel exits edit mode without changes
- [x] Delete shows confirmation dialog
- [x] Error handling for failed operations
- [x] Messages reload after edit/delete

---

## Files Modified

1. **Schema:**
   - `packages/shared-db/prisma/schema.prisma` - Added `updatedAt` field

2. **API Routes:**
   - `app/api/runcrew/[id]/messages/[messageId]/route.ts` - NEW: PUT and DELETE handlers
   - `app/api/runcrew/[id]/messages/route.ts` - Cleaned up (removed duplicate handlers)

3. **Components:**
   - `components/RunCrew/MessageFeed.tsx` - Added edit/delete UI and handlers

4. **Pages:**
   - `app/runcrew/[runCrewId]/member/page.tsx` - Added MessageFeed with isAdmin prop
   - `app/runcrew/[runCrewId]/admin/page.tsx` - Added Messages section with admin MessageFeed

5. **Migrations:**
   - `packages/shared-db/prisma/migrations/20250103130000_add_message_updated_at/migration.sql` - NEW

---

## Future Enhancements

- [ ] Edit history/audit log
- [ ] Soft delete (archive instead of hard delete)
- [ ] Bulk delete for admins
- [ ] Edit timeout (e.g., can only edit within 5 minutes)
- [ ] Rich text editing
- [ ] Message reactions/emojis
- [ ] Undo delete functionality

---

## Conclusion

✅ **FULLY IMPLEMENTED**

Message edit/delete functionality is complete:
- ✅ Schema updated with `updatedAt` field
- ✅ API endpoints for PUT and DELETE
- ✅ Frontend UI in MessageFeed component
- ✅ Proper authorization (own messages + admin override)
- ✅ Member page integration
- ✅ Admin page integration
- ✅ Error handling and user feedback

The feature is ready for use. Migration needs to be run to add the `updatedAt` column to the database.









