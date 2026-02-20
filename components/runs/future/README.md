# Future: Athlete Run Creation

## Status: PARKED - NOT IMPLEMENTED

This directory contains components for future athlete run creation functionality.

## Current State

**How athletes create runs:**
- Through runcrews via `/api/runcrew/[id]/runs` endpoint
- Runcrew admins/managers can create runs for their crew
- Athletes can RSVP to runs ✅ (working)

**What's NOT implemented:**
- Standalone run creation (one-off runs without a crew)
- Athlete run management UI
- Public run creation by athletes

## Future State

**Planned:**
- Athletes can create standalone runs
- Athletes can manage their own runs
- Public run creation flow

## Components

### CreateRunModal.tsx.PARKED
- Reference copy from GoFastCompany
- Contains full component code
- Needs adaptation for gofastapp-mvp:
  - Remove staff features (source tracking, strict validation)
  - Use local `api` client instead of `productAppApi`
  - Remove `cockpitRole` checks
  - Simplify validation

## Implementation Notes

When ready to implement:
1. Copy CreateRunModal from GoFastCompany
2. Remove staff-specific features
3. Update API calls to use local `api` client
4. Test thoroughly
5. Define UX flow for athlete run creation

## Related Files

- GoFastCompany: `/components/runs/CreateRunModal.tsx` (source)
- GoFastCompany: `/components/runs/StaffCreateRunModal.tsx` (staff version)
- API: `/app/api/runs/create/route.ts` (already exists, accepts data)
