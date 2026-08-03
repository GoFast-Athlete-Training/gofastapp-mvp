# Club Manager forks

Three product forks share similar UI but different authority models. Do not mix them in routing or copy.

## 1. Staff assign (current)

**Who:** GoFast staff assigns an existing athlete, or invites a new email.

**Authority:** `run_club_memberships` with write role (`manager` | `admin`). Loaded as `leaderContext.clubs` on athlete profile.

**Entry:**

1. Firebase sign-in
2. Athlete bootstrap (`GET /api/athlete/me`, profile if needed)
3. Read DB membership — no client "claim" ceremony for staff-assigned managers
4. **First visit:** `/welcome-clubmanager` — mental confirm ("You're managing {club}")
5. **Later visits:** straight to Club Manager — `Athlete.clubManagerState.welcomed[clubId]` persisted on ack

**Staff paths:**

- **Assign existing:** Company → `assignClubManagerMembership` on prod. Welcome link only.
- **Invite new (stashed machinery):** Creates `run_club_leader_claims` + token; voucher redeem via `/me/club-manager-resolve` only when no membership yet. After membership exists, same welcome flow as staff assign.

**Not authority:** `localStorage` invite token, `clubManagerMode` flag, claim row status.

## 2. Organic claim (future — stashed)

**Who:** Athlete discovers a club and taps "Claim this club."

**Authority:** Still `run_club_memberships` after staff validation — never client-side self-approve.

**Flow (planned):**

1. Athlete submits claim request
2. Staff reviews in Company
3. Staff writes membership (same as fork 1)
4. Same first-welcome / later-skip via `clubManagerState`

**Raw material:** `run_club_leader_claims` and invite-token APIs — do not delete; repurpose for pre-approval grants if needed. Do not use for staff-assign happy path.

## 3. Self-serve create (further future)

**Who:** Athlete creates a club while already an `athleteId`.

**Authority:** Ownership/membership from create — manage without invite stack.

**Validation:** Directory/trust rules TBD; separate from entry routing.

---

## Durable first vs later confirm

`Athlete.clubManagerState` (JSON):

```json
{
  "welcomed": {
    "<runClubId>": {
      "runClubSlug": "dc-road-runners",
      "runClubName": "DC Road Runners",
      "ackedAt": "2026-08-03T18:00:00.000Z"
    }
  }
}
```

- Helpers: [`lib/club-manager-state.ts`](../lib/club-manager-state.ts)
- Entry routing: [`lib/club-manager-entry-route.ts`](../lib/club-manager-entry-route.ts)
- Ack API: `POST /api/me/club-manager-welcome`
- Welcome UI: [`app/welcome-clubmanager/page.tsx`](../app/welcome-clubmanager/page.tsx)

## Related files

| Concern | Path |
|---|---|
| Membership write (staff) | `lib/domain-club-manager-staff-assign.ts` |
| Voucher redeem (invite_new only) | `lib/domain-runclub-leader-claim.ts`, `POST /api/me/club-manager-resolve` |
| Leader context | `lib/run-club-leader-context.ts` |
