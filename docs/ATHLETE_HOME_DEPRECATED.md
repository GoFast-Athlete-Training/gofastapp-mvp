# Athlete Home Page - Deprecated

## Status: DEPRECATED

The `/athlete-home` page is **deprecated** and currently redirects to `/runcrew`.

## Current Flow (MVP1)

**Active Pages:**
- `/runcrew` = General RunCrew landing page (join/create crews)
- `/profile` = Profile edit page
- `/runcrew/[runCrewId]` = Specific RunCrew home page

**Deprecated:**
- `/athlete-home` = Redirects to `/runcrew` (will be re-implemented in future)

## Why Deprecated?

The athlete-home page was designed for a more robust feature set that isn't ready yet. For MVP1, the flow is simplified:

1. **After profile setup** → `/runcrew` (general landing)
2. **After joining/creating crew** → `/runcrew/[runCrewId]` (specific crew home)
3. **Profile editing** → `/profile`

## Future Implementation

The athlete-home page will be re-implemented when we're ready for:
- Activity tracking dashboard
- Training plan integration
- Multi-crew management
- Personal stats and goals

For now, `/runcrew` serves as the main landing page.

