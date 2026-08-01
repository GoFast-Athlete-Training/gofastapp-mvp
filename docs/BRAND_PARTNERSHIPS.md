# GoFast Brand Partnerships (Prod)

Product name: **GoFast Brand Partnerships**.

## Ownership (Prod)

| Model | Purpose |
|---|---|
| `sponsorship_candidates` | Eligible athlete inventory (`GFA-…` codes) |
| `sponsor_commitments` | Flat runtime + payment record per partnership |

## APIs

- `GET /api/sponsorship/candidates` — public eligible inventory
- `GET /api/sponsorship/candidates/[code]` — lookup by stable code
- `POST /api/sponsor-commitments` — internal: create `CHECKOUT_PENDING` row (Company)
- `POST /api/sponsor-commitments/[id]/checkout-session` — internal: attach Stripe session
- `POST /api/sponsor-commitments/[id]/finalize-paid` — internal: idempotent paid activation + athlete notification
- `GET /api/sponsor-commitments/[id]` — read payment/runtime state
- `GET /api/athlete/me/sponsorships` — athlete sponsorship history

## Candidate codes

`GFA-…` codes are stable cross-repo lookup keys. They are not authorization secrets.

## Eligibility

Container toggle (`isGoFastContainer`) still controls candidate ensure/pause. Follow-driven monetization no longer auto-creates candidates.

## Rendering

Public athlete pages hydrate `activeSponsorship` from paid commitments where `startsAt <= now < endsAt`. Unpaid, canceled, and expired commitments render nothing.

## Migration notes

Legacy `advertising_candidates` / `advertising_blocks` rows were renamed in migration `20260731210000_sponsorship_candidates_and_commitments`. Historical purchased blocks map to paid `sponsor_commitments` with `pricingRuleKey = legacy-block`.

## Cron

`/api/cron/sponsor-commitments/maintain` — hourly `SCHEDULED`→`ACTIVE` and ended→`EXPIRED`.
