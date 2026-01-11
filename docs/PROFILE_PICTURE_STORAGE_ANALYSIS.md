# Profile Picture Storage Analysis

**Date**: January 2025  
**Issue**: Profile pictures are not being properly stored - need to use Vercel Blob storage

---

## Current State

### ✅ RunCrew Logos (Working Correctly)

**Location**: `app/runcrew/create/page.tsx`

RunCrew logos are **properly using Vercel Blob storage**:
- Uses `/api/upload` route which uploads to Vercel Blob
- Stores the returned blob URL in the database
- Implementation in `handleLogoUpload` function (lines 36-83)

**Flow**:
1. User selects image file
2. File is uploaded to `/api/upload` endpoint
3. `/api/upload` uses `@vercel/blob` to store the file
4. Returns the blob URL (e.g., `https://[hash].public.blob.vercel-storage.com/[filename]`)
5. URL is stored in database and used for display

### ❌ Profile Pictures (NOT Working)

**Locations**:
- `app/athlete-create-profile/page.tsx` (lines 118-139)
- `app/athlete-edit-profile/page.tsx` (lines 85-106)

Profile pictures are **NOT using Vercel Blob storage**:
- Uses `URL.createObjectURL(file)` which creates a **local blob URL**
- Local blob URLs are temporary and only exist in browser memory
- These URLs cannot be sent to the server or persisted

**Current Flow (BROKEN)**:
1. User selects image file
2. `URL.createObjectURL(file)` creates local blob URL (e.g., `blob:http://localhost:3000/abc-123`)
3. Local blob URL stored in state as `profilePhotoPreview`
4. On submit, sends local blob URL to API
5. API stores the local blob URL in database
6. **Problem**: Local blob URLs are temporary and won't work after page reload or on different devices

**Evidence**:
- `athlete-create-profile/page.tsx:275`: `const photoURL = firebaseUser.photoURL || formData.profilePhotoPreview;`
- `athlete-edit-profile/page.tsx:144`: `const photoURL = formData.profilePhotoPreview || firebaseUser.photoURL || null;`
- Both send `profilePhotoPreview` which is a local blob URL from `URL.createObjectURL(file)`

---

## The Problem

**Local Blob URLs are NOT persistent**:
- Created with `URL.createObjectURL(file)`
- Only exist in the current browser session
- Cannot be accessed by the server
- Will fail when:
  - Page is reloaded
  - User opens the profile on a different device
  - Server tries to fetch the image

**What Should Happen**:
- Upload file to Vercel Blob storage (like RunCrew logos)
- Get back a public URL from Vercel
- Store that URL in the database

---

## Solution

### 1. Update Profile Picture Upload Handlers

Update both `athlete-create-profile/page.tsx` and `athlete-edit-profile/page.tsx` to upload files to Vercel Blob storage, following the same pattern as RunCrew logos.

**Changes Needed**:
1. Modify `handleImageUpload` to upload to `/api/upload` endpoint
2. Store the returned blob URL instead of local blob URL
3. Add loading state during upload
4. Handle upload errors

### 2. Environment Variable

**Required**: `BLOB_READ_WRITE_TOKEN`

This environment variable is needed for Vercel Blob storage but is **not documented** in `ENV_SETUP.md`.

**How to get it**:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `BLOB_READ_WRITE_TOKEN`
3. Get the token from Vercel Blob storage settings

**Update `ENV_SETUP.md`** to document this variable.

---

## Implementation Details

### Upload API Route

**File**: `app/api/upload/route.ts`

Already exists and works correctly:
- Validates file type (images only)
- Validates file size (5MB max)
- Uses `@vercel/blob` to upload
- Requires `BLOB_READ_WRITE_TOKEN` environment variable
- Returns `{ success: true, url: blob.url }`

### Database Schema

**Field**: `Athlete.photoURL` (String?, nullable)

The database schema already supports storing photo URLs - just needs the correct URL (Vercel Blob URL) instead of local blob URL.

---

## Recommended Fix

1. **Update `athlete-create-profile/page.tsx`**:
   - Change `handleImageUpload` to upload to `/api/upload`
   - Store blob URL in state instead of local blob URL
   - Add upload loading state

2. **Update `athlete-edit-profile/page.tsx`**:
   - Same changes as above

3. **Update `ENV_SETUP.md`**:
   - Document `BLOB_READ_WRITE_TOKEN` environment variable

4. **Test**:
   - Upload profile picture
   - Verify URL is a Vercel Blob URL (not local blob URL)
   - Verify image persists after page reload
   - Verify image displays correctly

---

## Reference Implementation

See `app/runcrew/create/page.tsx` lines 36-83 (`handleLogoUpload`) for the correct implementation pattern.

**Key Pattern**:
```typescript
// Upload to Vercel Blob via our API
const uploadFormData = new FormData();
uploadFormData.append('file', file);

const uploadResponse = await fetch('/api/upload', {
  method: 'POST',
  body: uploadFormData,
});

const uploadData = await uploadResponse.json();

if (uploadResponse.ok && uploadData.url) {
  setLogo(uploadData.url); // Store the blob URL
} else {
  throw new Error(uploadData.error || 'Failed to upload');
}
```





