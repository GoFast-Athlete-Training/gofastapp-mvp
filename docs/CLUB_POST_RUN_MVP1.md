# Club post-run MVP1

## Ownership (no new join table)

- Universal `city_runs` rows; club programming = direct **`runClubId`** bolt-on.
- `run_series` = recurrence template only (also has `runClubId`).
- No `club_city_runs` table.

## Lanes

| Lane | Model | Job |
|---|---|---|
| Club calendar | `city_runs.runClubId` | Which runs belong to the club |
| Athlete attendance | `city_run_rsvps` | I'm going |
| Athlete credit | `city_run_checkins`, `city_run_activity_links` | I was there / wearable — **not hub feed** |
| Club post-run | `city_runs.postRun*` fields | Manager-published recap on that occurrence |

## Post-run fields (on `city_runs`)

- `postRunNote` — recap text
- `postRunPhotoUrl` — group photo (Vercel Blob)
- `postRunPublished` — hub gate
- `postRunPublishedAt` — when published

Separate from staff `published` / `workflowStatus` go-live and from pre-run `postRunActivity`.

## Hub hydrate

`GET /api/runclub/[slug]` returns `completedRunFeed`: club runs in the last **14 days** with `postRunPublished: true`.

## Manager flow

Club Manager → Runs → completed section → upload photo, note → **Publish**.

Leader API: `PATCH /api/runclub/[slug]/leader/runs/[runId]`.
