# Advertising Candidate → Block (MVP1)

Prod owns eligibility (`advertising_candidates`) and durable purchases (`advertising_blocks`). Brand Placement owns canonical creatives and purchase workflow. Company remains finance-only.

## Prod models

- `advertising_candidates` — one per container-enabled athlete; stable `GFA-…` code
- `advertising_blocks` — append-only purchase rows with creative snapshot

## Lifecycle

- Container toggle ON → `ensureAdvertisingCandidateForAthlete`
- Container toggle OFF → pause candidate (never delete code)
- Backfill: `npm run db:backfill-advertising-candidates`

## APIs

- `GET /api/advertising/candidates` — eligible candidates for Brand
- `GET /api/advertising/candidates/[code]` — lookup by purchase code
- `POST /api/advertising/blocks/create` — Firebase-verified Block creation
- `POST /api/cron/advertising-blocks/expire` — status maintenance

## Page hydration

`loadPublicAthletePage` includes `activeAdvertisingBlock` when term is active.  
`ProfileContainerAdSlot` renders `ProfileContainerAdBlock` — no remote serve, no impressions.
