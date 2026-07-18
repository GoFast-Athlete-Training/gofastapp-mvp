# GoFast With Me model

## Profile vs GoFast With Me vs page

| Concept | Owner | Role |
|---|---|---|
| **Profile** | `Athlete` | Human identity: name, photo, `Athlete.bio`, `gofastHandle`, location, hero `myBestRunPhotoURL` |
| **GoFast With Me** | `gofast_with_me` | Public invite identity: welcome, GoFast-athlete bio, expectations, sport/model focus, achievements |
| **Public page** | Render surface only | `/u/[slug]`, contentpublic `/runner/[slug]`, `runner.gofastcrushgoals.com/{slug}` |

Visitor URLs resolve via **`gofast_with_me.gofastSlugSnapshot`** first, then join `Athlete` for identity and container. Legacy athletes without a row backfill via handle lookup.

**Wrong mental model:** athleteId = profile = page (hydrate everything off Athlete alone).

**Right mental model:** GoFast With Me is an optional athlete-scoped invite row; the page renders it plus auto-hydrated modules from existing product tables.

## Hydration paths

### Studio (owner)

1. Local session → `athleteId`
2. Load `Athlete`
3. `ensureGoFastWithMeForAthlete(athleteId)` — creates row if missing
4. Default slug from handle when `slugUsesHandle` is true; athlete may set a custom GoFast With Me URL

### Public (visitor)

1. `/u/slug` → lookup `gofast_with_me.gofastSlugSnapshot`
2. Join `Athlete`
3. Hydrate cards from Athlete FK relations (plans, runs, races, container, etc.)

## `gofast_with_me` fields (v1)

| Field | Purpose |
|---|---|
| `gofastSlugSnapshot` | Public URL key (unique) |
| `slugUsesHandle` | When true, slug follows `Athlete.gofastHandle` on handle change |
| `welcome` | Invite opener |
| `gofastWithMeBio` | Public GoFast-athlete bio — separate from `Athlete.bio`; may seed from profile bio |
| `whatYoullSeeHere` | Expectation guide for visitors |
| `sportFocus` | Sport angle (run, trail, tri, etc.) |
| `modelFocus` | Journey/distance model (marathon, 5K, comeback, etc.) |
| `myAchievements` | Credibility / lived experience |

`nextRace` is **not** a column — it is a derived card from active training plan, active goal, or race signups.

## Studio (`/profile/gofast-page`)

Route name unchanged for now; user-facing concept is **GoFast With Me**.

- Handle gate
- GoFast With Me URL (handle default or custom slug)
- Intro editor (`welcome`, `gofastWithMeBio`, `whatYoullSeeHere`, `sportFocus`, `modelFocus`, `myAchievements`)
- Hero photo (`Athlete.myBestRunPhotoURL`)
- Container toggle + partner earnings
- Live preview

API: `GET/PATCH /api/me/gofast-with-me`

## Auto-hydrated modules

| Module | Source |
|---|---|
| Next race | Plan / AthleteGoal / race signups (derived) |
| Training plan summary | `training_plans` |
| Published plans | `training_plans.publicVisibility` |
| Public runs | `city_runs.published` |
| Group training | cohort service |
| Container | `Athlete.isGoFastContainer` |
| Profile bio strip | `Athlete.bio` (human profile — not GoFast With Me bio) |

## Deferred

- Tips, `myRunRoutes`, storefront/service module tables
- Share hub reframe (`/profile/share`)
- Mobile studio parity
- Hard-gating modules behind container
