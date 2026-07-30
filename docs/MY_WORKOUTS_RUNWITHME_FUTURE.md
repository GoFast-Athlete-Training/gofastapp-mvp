# My Workouts — future hosted-run activation (deferred)

MVP1 ships **My Workouts** as a creator-facing mirror of the My Training week strip plus plan-sharing controls. Workout-to-hosted-run activation is intentionally **not** in MVP1.

## Existing chain (do not duplicate)

When we add per-workout activation later, reuse this path:

1. Materialize planned day → `GET /api/training/workout/day` via [`resolveWorkoutForPlanDay()`](../lib/training/fetch-plan-week-client.ts)
2. Creator form → [`/workouts/{id}/let-others-join`](../app/workouts/[id]/let-others-join/page.tsx) + [`CreateCityRunForm`](../components/cityruns/CreateCityRunForm.tsx)
3. Persist run → `POST /api/cityrun/from-workout` → `city_runs.workoutId`

Alternate lighter path (`/training/schedule-run`) does **not** create `city_runs` and is not the GoFast With Me loop.

## Naming (unresolved)

- **Run with {Name}** — public door module on `/u/[handle]` for upcoming hosted runs
- **Host a run**, **Build a Run**, **Schedule this run**, **Let others join** — existing creator verbs in GoRun/training

Pick one athlete-facing CTA when wiring studio actions; do not introduce a fourth product name without canon update.

## Visibility gap to resolve before promising hub surfacing

`POST /api/cityrun/from-workout` sets `workflowStatus: APPROVED` but does **not** set `published: true`.

GoFast With Me door/hub hosted-run modules filter on `published: true` (`loadPublicAthletePage`). A future studio “activate this workout” flow must explicitly set publish visibility (or document that the run is share-link-only until published).

## Recommended MVP2 handoff

- Week card action on materialized `workoutId` → `/workouts/{id}/let-others-join`
- If `city_runs` already linked and upcoming → **View Run with Me** (GoRun path) instead of duplicate create
- Orphaned but useful UI: `GoFastWithMeRunsPanel`, `ContainerHubRunsSection` (not wired in studio today)
