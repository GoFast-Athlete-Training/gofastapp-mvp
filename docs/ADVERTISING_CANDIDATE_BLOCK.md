# Advertising Candidate → Block (MVP1)

Prod owns eligibility (`advertising_candidates`) and durable purchases (`advertising_blocks`). Brand Placement owns canonical creatives and purchase workflow. Company remains finance-only.

## Prod models

- `advertising_candidates` — one per container-enabled athlete; stable `GFA-…` code
- `advertising_blocks` — append-only purchase rows with creative snapshot

## Lifecycle

- Container toggle ON → `ensureAdvertisingCandidateForAthlete`
- Container toggle OFF → pause candidate (never delete code)
- Deploy migration `20260727200000_backfill_advertising_candidates` backfills existing container athletes automatically
- Manual re-run: `npm run db:backfill-advertising-candidates`

## APIs

- `GET /api/advertising/candidates` — eligible candidates for Brand
- `GET /api/advertising/candidates/[code]` — lookup by purchase code
- `POST /api/advertising/blocks/create` — Firebase-verified Block creation (validates candidate ID **and** code)
- `POST /api/cron/advertising-blocks/expire` — hourly status maintenance (scheduled in `vercel.json`)

## Page hydration

`loadPublicAthletePage` includes `activeAdvertisingBlock` when term is active.  
`ProfileContainerAdSlot` renders `ProfileContainerAdBlock` — no remote serve, no impressions.
