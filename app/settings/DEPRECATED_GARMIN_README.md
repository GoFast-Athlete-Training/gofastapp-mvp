# Garmin Integration - DEPRECATED FOR MVP1

**Status:** Code preserved but disabled for Phase 1 / MVP1

## Overview

Garmin integration has been deprecated for MVP1 to narrow scope and focus on core RunCrew functionality. All Garmin-related code has been commented out but preserved for future re-enablement.

## Files Affected

### Settings Pages
- `app/settings/page.tsx` - Garmin connection UI commented out
- `app/settings/garmin/page.tsx` - Entire Garmin settings page (preserved)
- `app/settings/garmin/callback/page.tsx` - OAuth callback page (preserved)
- `app/settings/garmin/success/page.tsx` - Success page (preserved)

### API Routes (Preserved, Not Modified)
- `app/api/garmin/status/route.ts`
- `app/api/garmin/sync/route.ts`
- `app/api/garmin/webhook/route.ts`
- `app/api/auth/garmin/authorize/route.ts`
- `app/api/auth/garmin/callback/route.ts`

### UI References
- `app/athlete-home/page.tsx` - Garmin connection prompt commented out (Phase 1)
- Activities/Garmin stats are disabled for MVP1

## Minimal Settings

A new minimal settings page has been created:
- `app/settings-minimal/page.tsx` - Profile settings only

## Re-enabling Garmin (Future)

To re-enable Garmin integration:

1. Uncomment Garmin connection UI in `app/settings/page.tsx`
2. Uncomment Garmin connection functions
3. Restore `connections` state management
4. Uncomment Garmin connection prompt in `app/athlete-home/page.tsx` (if activities are re-enabled)
5. Verify API routes are still functional
6. Test OAuth flow

## Notes

- All Garmin API routes remain intact and functional
- Database schema for Garmin connections is preserved
- Code is commented with `// DEPRECATED` markers for easy search
- Use `settings-minimal` page as reference for MVP1 settings pattern

