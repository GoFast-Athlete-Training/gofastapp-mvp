# My Workouts — hosted-run activation

**My Workouts** is an editor-first studio workspace — not a second My Training dashboard. Athletes polish plan title and follower intro, preview the public hub view on demand, and optionally build a GoRun With Me from a planned workout.

## Active chain

1. Studio picker → lazy-load current plan week via `GET /api/training/plan/week`
2. Materialize planned day when needed → `GET /api/training/workout/day` via [`resolveWorkoutForPlanDay()`](../lib/training/fetch-plan-week-client.ts)
3. Creator form → [`/workouts/{id}/let-others-join`](../app/workouts/[id]/let-others-join/page.tsx) + [`CreateCityRunForm`](../components/cityruns/CreateCityRunForm.tsx)
4. Persist run → `POST /api/cityrun/from-workout` → `city_runs.workoutId`

Alternate lighter path (`/training/schedule-run`) does **not** create `city_runs` and is not the GoFast With Me loop.

## Studio UX

- Default surface: plan title, follower intro, Private/Public, explicit **Save changes**
- Public preview: primary **See how your plan looks to others** → `/container/{landingSlug}#plan-strip`
- GoRun builder: collapsed until **Choose a workout**; compact week picker only (not full `PlanWeekViewer`)

## Visibility

`POST /api/cityrun/from-workout` sets both `workflowStatus: APPROVED` and `published: true` via [`WORKOUT_BACKED_CITY_RUN_VISIBILITY`](../lib/cityrun/workout-backed-run-visibility.ts), so workout-backed runs appear on GoFast With Me door/hub surfaces immediately after creation.

## Naming (still mixed in product)

- **Run with {Name}** — public door module on `/u/[handle]` for upcoming hosted runs
- **Build a GoRun With Me** — studio CTA on My Workouts
- **Host a run**, **Build a Run**, **Schedule this run**, **Let others join** — existing creator verbs elsewhere

Pick one athlete-facing verb per surface; do not introduce a fourth product name without canon update.

## Follow-ups

- If `city_runs` already linked and upcoming for a workout → **View Run with Me** instead of duplicate create
- Orphaned but useful UI: `GoFastWithMeRunsPanel`, `ContainerHubRunsSection` (not wired in studio sidebar today)
