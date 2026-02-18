# Runs not hydrating: "run_crew_runs does not exist"

## Symptom

- `GET /api/runs` (e.g. with `includeRunClub=true`) returns 500.
- Error: `The table 'public.run_crew_runs' does not exist in the current database.`
- Log line: `[GET /api/runs] Proxy error (500): ... Invalid prisma.city_runs.findMany() invocation ... run_crew_runs does not exist`

## Cause

The **database** was migrated from table `run_crew_runs` to `city_runs` (migration `20260206114844_rename_run_crew_runs_to_city_runs`). The **deployed app** (e.g. pr.gofastcrushgoals.com) was built with an **older Prisma client** that still targeted the old table name `run_crew_runs`. So the running code queries a table that no longer exists.

- Local schema and generated client use table **city_runs** (correct).
- Deployed build can still be using a client that queries **run_crew_runs** (stale).

## Fix

1. **Redeploy** the gofastapp-mvp app (e.g. PR/preview and production) so the deployment uses the current Prisma schema and a freshly generated client that queries `city_runs`.
2. The schema now has an explicit `@@map("city_runs")` on the `city_runs` model so the table name is unambiguous and future builds cannot accidentally use the old name.

## Verification

- After redeploy, `GET /api/runs?includeRunClub=true` should return 200 and city runs should hydrate in the public app.
