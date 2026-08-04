# Club Manager forks

Two doors, three product forks. Do not collapse the doors with a global "has membership → club manager" redirect.

## Doors (which surface you land on)

| Door | Host / entry | Default after sign-in |
|---|---|---|
| **Club door** | `clubmanage.*` → `/welcome-clubmanager` | **Manage** → club dashboard (no athlete shell on this path) |
| **Athlete door** | app host → `/welcome` / `/athlete-home` | Athlete home; Club Manager is opt-in (`ClubManagerHomeCard`) |

Managers are dual identity: same Firebase + `athleteId`, but which surface you see depends on which door you walked through.

## `/home` is dead

- **`/home`** was a legacy RunCrew-era route, later repurposed as a hidden manager router — **removed**.
- Bookmarks to `/home` redirect permanently to **`/athlete-home`** via `next.config.mjs`.
- **Never reintroduce `/home`** as a navigation target or smart router.

## Athlete escape hatch (club door only)

- Club welcome (`/welcome-clubmanager`) does **not** link to athlete-home — manager path only.
- After entering Club Manager, **"Back to athlete" → `/athlete-home`** lives in:
  - [`ClubManagerShell`](../components/runclub/manager/ClubManagerShell.tsx)
  - [`ClubManagerHubShell`](../components/runclub/manager/ClubManagerHubShell.tsx)
  - [`ClubManagerConfirmWelcome`](../components/runclub/manager/ClubManagerConfirmWelcome.tsx) (first-time confirm, already in shell flow)

## First-time confirm vs welcome fork

- **`/welcome-clubmanager`** — "Welcome back" + **Manage {club}** only. No DB ack on this page.
- **`ClubManagerShell`** — first visit to a club dashboard shows `ClubManagerConfirmWelcome` once; `POST /api/me/club-manager-welcome` writes `clubManagerState`. Later visits skip confirm.

Do **not** use `localStorage` for confirm. Do **not** redirect unwelcomed managers back to welcome from athlete surfaces.

## Run go-live (manager self-publish)

Club managers **do not** submit runs for GoFast staff review in MVP. They self-publish:

- `PATCH /api/runclub/[slug]/leader/runs/[runId]` with `workflowStatus: APPROVED` sets `published: true` via [`fieldsWhenSettingWorkflowStatus`](../lib/runInstanceApprovalPublish.ts).
- Leader **Reuse/advance** (`POST /api/runclub/[slug]/leader/instances`) and product cron advance create instances as **APPROVED + published**.
- Staff/Company VA workflow (`POST /api/runs/advance-instances`, companypush seeds) may still create `DEVELOP` rows — that is separate from Club Manager.

Org hierarchy / multi-approver review within a club org is **MVP5** — not part of Club Manager MVP.

---

## 1. Staff assign (current)

**Who:** GoFast staff assigns an existing athlete, or invites a new email.

**Authority:** `run_club_memberships` with write role (`manager` | `admin`). Loaded as `leaderContext.clubs` on athlete profile.

**Entry:**

1. Firebase sign-in
2. Athlete bootstrap (`GET /api/athlete/me`, profile if needed)
3. Read DB membership — no client "claim" ceremony for staff-assigned managers
4. **Club door:** `/welcome-clubmanager` → Manage
5. **First dashboard visit:** shell confirm → DB ack
6. **Later visits:** straight to club dashboard

**Staff paths:**

- **Assign existing:** Company → `assignClubManagerMembership` on prod. Welcome link only.
- **Invite new (stashed machinery):** Creates `run_club_leader_claims` + token; voucher redeem via `/me/club-manager-resolve` only when no membership yet. After membership exists, activate page redirects to club path (no re-redeem).

**Not authority:** `localStorage` invite token, `clubManagerMode` flag, claim row status.

## 2. Organic claim (future — stashed)

**Who:** Athlete discovers a club and taps "Claim this club."

**Authority:** Still `run_club_memberships` after staff validation — never client-side self-approve.

**Flow (planned):**

1. Athlete submits claim request
2. Staff reviews in Company
3. Staff writes membership (same as fork 1)
4. Same shell confirm / `clubManagerState` skip on return

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
      "runClubSlug": "the-ballston-runaways",
      "runClubName": "The Ballston Runaways",
      "ackedAt": "2026-08-03T18:00:00.000Z"
    }
  }
}
```

- Helpers: [`lib/club-manager-state.ts`](../lib/club-manager-state.ts)
- Entry routing (no welcome hijack): [`lib/club-manager-entry-route.ts`](../lib/club-manager-entry-route.ts)
- Host routing: [`lib/product-host.ts`](../lib/product-host.ts)
- Ack API: `POST /api/me/club-manager-welcome`
- Confirm UI: [`ClubManagerConfirmWelcome.tsx`](../components/runclub/manager/ClubManagerConfirmWelcome.tsx) in [`ClubManagerShell`](../components/runclub/manager/ClubManagerShell.tsx)
- Club welcome: [`app/welcome-clubmanager/page.tsx`](../app/welcome-clubmanager/page.tsx)

## Related files

| Concern | Path |
|---|---|
| Membership write (staff) | `lib/domain-club-manager-staff-assign.ts` |
| Voucher redeem (invite_new only) | `lib/domain-runclub-leader-claim.ts`, `POST /api/me/club-manager-resolve` |
| Leader context | `lib/run-club-leader-context.ts` |
| Single-club home path | `lib/club-manager-home-route.ts` |
| Opt-in from athlete home | `components/runclub/manager/ClubManagerHomeCard.tsx` |
