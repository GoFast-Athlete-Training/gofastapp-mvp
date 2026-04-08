# Race memberships vs `athlete_race_signups` vs `run_crew_specific_races`

## `race_memberships` (new)

- **Purpose:** Athlete has joined the **race container** and can use race chatter, see race events in the app, and post messages scoped to `race_registry.id`.
- **Gate:** `GET/POST /api/race-hub/[raceRegistryId]/messages`, announcements (read), events (read/create), event RSVPs.

## `athlete_race_signups` (existing)

- **Purpose:** Self-declared “I’m doing this race” list in the product; optional link to an `AthleteGoal` via `goalId`.
- **UI:** “My races” / planning surfaces.

## Sync behavior

After **`POST /api/race-signups`** succeeds, the API now also **`upsertRaceMembershipFromSignup`**, so declaring a race signup automatically creates a `race_memberships` row when missing. That unblocks chatter without a separate “join container” call for athletes who already use race signups.

Athletes can **`POST /api/race-hub/[raceRegistryId]/join`** to join the Race Hub (full membership: chatter, members, announcements, events).

## `run_crew_specific_races` (legacy junction)

- **Purpose:** Links a **run crew** to a target `race_registry` row (“this crew is training for Boston”).
- **Overlap:** Does not grant race chatter; membership for chatter is **`race_memberships`** (or synced signup) only.
- **Deprecation:** Do not delete yet. Prefer **`run_crews.trainingForRace`** and/or explicit crew UX over the junction table for new features; migrate references when convenient.

## `race_trainer_groups` (downstream)

- Optional structured training cohort for a race. Unchanged. Requires its own `race_trainer_members` join; separate from `race_memberships`.
