# GoFastWithMe Concept Canon

## Core Mental Model

GoFastWithMe is the public-facing concept layer. It is how someone discovers an athlete, understands what they offer, and decides whether to follow or join something.

The actual app hydration does not belong to a standalone GoFastWithMe product object. The real owner is the athlete.

Keep this split clear:

- `gofast_with_me` is the public page identity and copy layer.
- `Athlete.id` is the hydration key for the owner, follower container, feed, members, hosted runs, and published training modules.
- Plan content comes from training plan/public plan state.
- Run content comes from hosted public runs.
- The follower/member surface is the athlete-owned container.

Do not invent a second configuration model inside GoFastWithMe for things that already hydrate from athlete, plan, or run data.

CMS content is athlete-owned. Treat the athlete like a solo company/creator:

- Tips, myRunRoutes, and Blog should foreign-key to `Athlete.id`.
- They may also reference `gofast_with_me` if needed for ordering/display on that public surface, but authorship/ownership is the athlete.
- This keeps content portable across the public landing, member container, and future monetization surfaces.
- Do not make content ownership depend only on a page/surface row.

## Core Loop (GoFast With Me)

Product name: **GoFast With Me** — not "athlete container," not short "GoFast" (company).

```text
What I'm training for (e.g. MCM)
  → I'm a GoFast athlete with a goal
  → I have a GoFast plan (planId / training_plans)
  → I surface that plan (public visibility)
  → Plan strip shows the week in the hub
  → Others see the goal + the work → they follow / join the journey
```

Door (`/u/[handle]`) answers: **who am I training with / what are they chasing?**  
Hub (`/container/[handle]`) answers: **what's their week look like — can I follow along?**

| Priority | Surface | Where | Role |
|----------|---------|-------|------|
| **P0** | What I'm training for | Door + hub header | Goal/race identity via `GoalRaceCard` / plan goal hydrate |
| **P0** | Plan strip | Hub (members); teaser on door if public | Week view of surfaced GoFast plan |
| P1 | Messages | Hub | Journey announcements (`gofast_container_messages`) |
| P1 | What I'm thinking about | Hub / door later | Tips / voice (`athlete_tips` etc.) |
| **P2 v2** | My Runs | Hub (collapsed) | Manual `city_runs.athleteGeneratedId` — not primary loop |

Boundary sentence:

> Door surfaces What I'm training for. Hub surfaces Plan strip for that same plan. Others join the journey. My Runs is v2.

## The Crucial Product Fork

The product must keep two surfaces clear:

1. Landing page
   - This is the public "who am I?" surface.
   - It combines GoFastWithMe CMS content with athlete-scoped public data.
   - It helps strangers understand the athlete and decide to follow/join.
   - It is not the monetizable relationship layer by itself.

2. Container (GoFast With Me member hub)
   - This is how the athlete engages fans/followers after they follow.
   - This is where the audience relationship lives at `/container/[handle]`.
   - **P0 surfaces (scroll layout, not tabs):**
     - **What I'm training for** — goal/race identity in hub header (same signal as door `GoalRaceCard`).
     - **Plan strip** — week view of the host's surfaced GoFast plan (`training_plans` public fields).
   - **P1 surfaces:** Messages (journey announcements), What I'm thinking about (tips/voice — later).
   - **P2 v2:** My Runs — manual hosted `city_runs`; not the primary loop.
   - `gofast_with_me` holds door copy/photo only — no plan or goal config duplicated there.

Do not overplay the public landing page and forsake the container. The landing page is the door. The container is the room.

## Studio Is The Top Level

`GoFastWithMe Studio` is the top-level owner shell.

The studio is not one section. It is the operating center that connects:

- CMS / public landing and content.
- Add My Plan / athlete-owned plan publishing.
- Member Manager / container audience engagement.
- View as member / the follower-facing container.

Do not rename the whole product to CMS. CMS is a major area inside Studio.

## Product Purpose

GoFastWithMe is not a static profile page or a "look at me" brochure.

It should feel like a living public creator surface for an athlete:

- A visitor can understand who the athlete is and why they should follow, train, run, or engage.
- The athlete can keep the page fresh with posts, tips, route ideas, and training context.
- The landing page can behave like a lightweight live blog: timely updates and useful content layered on top of the core intro.
- The member container turns that public interest into an audience relationship.

The CMS exists so the athlete can publish useful public content without needing a company account. Think of the athlete as a solo creator/company with their own public surface.

GoFastWithMe CMS should support athlete-scoped production content:

- Tips.
- myRunRoutes.
- Blog posts / updates.

These content types should be owned by `Athlete.id`. They may link to `gofast_with_me` for public-surface placement and ordering, but the athlete is the author and owner.

Naming matters:

- Use short `athlete_*` table names for CMS content (e.g. `athlete_tips`, later `athlete_run_routes`, `athlete_blog_posts`).
- Use `myRunRoutes` in product copy for athlete-authored running routes so it is not confused with Next.js/API routes.
- Keep container feed topics separate from durable CMS content.

## MVP1 Studio Areas

Use names that match the fork:

1. `GoFastWithMe CMS`
   - Controls the landing page and public content.
   - Landing content: public copy, page photo, athlete intro, and athlete-scoped "who am I?" content.
   - Production CMS content types: Tips, myRunRoutes, and Blog.
   - CMS content can appear on the landing page and can also feed the container/member experience when explicitly designed.
   - Historical note: an early `20260718120000_gofast_pages` migration briefly had page-scoped `athlete_tips` and `gofast_page_routes`; `20260718140000_gofast_with_me_refactor` dropped those when `gofast_pages` became `gofast_with_me`.
   - Current schema: `athlete_tips` is restored as athlete-owned CMS content (FK to `Athlete.id`, not `gofast_with_me`).
   - Current schema has `gofast_container_messages.topic = tips`, but that is a container feed post topic, not a CMS content model.
   - Important naming correction: old `gofast_page_routes` meant athlete/run routes attached to the GoFastWithMe page, not Next.js page routes. Future naming should be `myRunRoutes`.

2. `GoFastWithMe Add My Plan`
   - Replaces vague `Configure` language for MVP1.
   - Lets the athlete connect/publish/toggle the active training plan.
   - Lets the athlete edit public plan description.
   - Hydrates from signed-in `Athlete.id` and active `planId`.

3. `GoFastWithMe Member Manager`
   - Controls how the athlete speaks to and shares with their specific audience.
   - Followers, announcements, member feed, and links to view the member container.
   - This is the owner/manager side of the container.

`General Content` as a separate top-level area is the wrong shape. Content belongs under `GoFastWithMe CMS`.

## Breakage Trace To Keep Straight

There are three related surfaces, but they are not the same thing:

1. `GoFastWithMe Studio`
   - The mondo UX that connects the dots.
   - It should guide the owner through setup and show which athlete-owned modules are live.
   - It reads from the signed-in `Athlete.id`.

2. `GoFastWithMe Landing`
   - The public doorway already discussed.
   - It owns public-facing intro/copy/photo only.
   - It is not the hydrated member container.

3. `Add My Plan`
   - This is the pass-2 setup area.
   - Its core job is training plan/public plan setup.
   - It should hydrate the full meta of the owner athlete's active `planId`.
   - It should let the owner toggle/publish the training plan and edit public descriptions.
   - Hosted public runs are the other optional setup path: "show a run I am doing."

Pause the model here before adding pass-3 ideas.

## Ownership Boundaries

### GoFastWithMe CMS Owns

GoFastWithMe CMS owns the public doorway and public content system:

- Public slug/snapshot.
- Landing copy.
- Public page photo.
- Creator framing copy.
- The concept of "GoFast with this athlete."
- CMS content types: Tips, myRunRoutes, Blog.

Code areas:

- `app/u/[handle]/page.tsx`
- `lib/server/load-public-athlete-page.ts`
- `lib/gofast-with-me/gofast-with-me-service.ts`
- `components/gofast-with-me/GoFastWithMeLandingForm.tsx`
- `components/gofast-with-me/GoFastWithMeWelcomePanel.tsx`

Current schema reality:

- `gofast_with_me` exists for public identity/copy.
- `athlete_tips` exists for durable athlete-owned CMS tips (`Athlete.id` FK).
- `gofast_page_routes` existed briefly in the old page model, then was dropped; future run-route CMS should use a short name like `athlete_run_routes`.
- `gofast_container_messages` supports a `tips` topic, but that belongs to the member container feed — not `athlete_tips`.
- Blog and myRunRoutes tables are not in schema yet; add them later with the same short `athlete_*` style when needed.
- CMS content FKs to `Athlete.id` for ownership/authorship; no requirement to also FK `gofast_with_me` for v1.

### Athlete Owns

The athlete owns the actual hydrated surface:

- The host identity.
- The public handle.
- Whether the follower container is enabled via `Athlete.isGoFastContainer`.
- Followers/members through `gofast_container_memberships.containerAthleteId`.
- Container messages through `gofast_container_messages.containerAthleteId`.
- Hosted runs through athlete-owned run data.
- Published plans through athlete-owned training/public plan data.

Code areas:

- `prisma/schema.prisma`
- `lib/gofast-with-me/container-hub-service.ts`
- `lib/gofast-with-me/follow-service.ts`
- `app/container/[handle]/page.tsx`
- `app/api/athlete/[id]/container/hub/route.ts`
- `app/api/athlete/[id]/container/messages/route.ts`

### Plan Owns

The training plan module is not GoFastWithMe configuration. It is plan data shown through the public page and member container.

The owner creates the plan in training setup. Configure should then hydrate that athlete-owned plan state and help publish/share it.

Code areas:

- `lib/server/load-share-hub-status.ts`
- `lib/training/public-plan-service.ts`
- `components/training/LeadTrainingPlanPanel.tsx`
- `app/container/[handle]/page.tsx`
- `app/training/lead/page.tsx`
- `app/api/public-training-plans/route.ts`
- `app/api/public-training-plans/[slug]/route.ts`
- `app/api/training-plan/[id]/promote-public/route.ts`

Important detail:

- The member container displays the first published public plan for the host athlete.
- Plan publishing currently lives on `training_plans`: `publicSlug`, `publicVisibility`, `publicPublishedAt`, and `publicDescription`.
- That means the plan section is plan/public-plan driven, not a stored GoFastWithMe module.
- The follow/member container is athlete-owned; the plan module inside it hydrates from the host athlete's published plan.

### Runs Own

Runs are optional surfaced activity. They are not the core GoFastWithMe setup object.

If the athlete wants to show a run they are doing, GoFastWithMe should surface hosted public runs from existing run data.

Code areas:

- `lib/server/load-public-athlete-page.ts`
- `lib/server/load-share-hub-status.ts`
- `components/gofast-with-me/GoFastWithMeSetupPanel.tsx`
- `app/container/[handle]/page.tsx`

## Hydration Trace

Public page trace:

```text
/u/[handle]
  -> loadPublicAthletePage(handle)
  -> resolve gofast_with_me by slug
  -> load owner Athlete
  -> hydrate public modules from Athlete.id
  -> resolve actions from hosted runs, published plans, group training, follow
```

Follow trace:

```text
Public GoFastWithMe page
  -> Follow CTA
  -> /follow/[handle]
  -> resolveFollowTargetBySlug(handle)
  -> get hostAthleteId from gofast_with_me.athlete.id
  -> upsert gofast_container_memberships(containerAthleteId, memberAthleteId)
  -> enable Athlete.isGoFastContainer
```

Member container trace:

```text
/container/[handle]
  -> public athlete lookup gets hostAthleteId
  -> GET /api/athlete/[hostAthleteId]/container/hub
  -> loadContainerHubForHost(hostAthleteId, callerAthleteId)
  -> hydrate members, messages, training-for context, first published public plan, optional hosted runs
```

Members / followers trace (thin read):

```text
Studio Central count OR My Community follower list
  -> GET /api/athlete/[hostAthleteId]/container/members
  -> gofast_container_memberships count + recent memberAthlete rows
```

Plan trace inside the container:

```text
hostAthleteId
  -> listPublicPlansForAthlete(hostAthleteId)
  -> first publicSlug
  -> getPublicPlanBySlug(publicSlug)
  -> compute plan weeks
  -> render PublicPlanWeekViewer
```

Configure plan trace:

```text
signed-in Athlete.id
  -> load active training_plans row
  -> read plan id, name, schedule, race metadata
  -> read publicSlug, publicVisibility, publicDescription
  -> show toggle/publish state and public description editor
  -> POST /api/public-training-plans or /api/training-plan/[id]/promote-public
  -> PATCH /api/public-training-plans/[slug] for metadata updates
```

Run trace inside public/member surfaces:

```text
host Athlete.id
  -> load athlete hosted public runs
  -> show next run / upcoming runs when present
```

## Studio Flow Canon

The studio (`/gofast-with-others`) is **Studio Central + four peer bins** — door, room, plan, and content.

1. **Studio Central** (home)
   - Setup progress + **follower count** from `GET /api/athlete/[id]/container/members` (junction count only).
   - Setup tiles for **My Page**, **My Community**, **My Plan**, and **My Content**.
   - **Share your page** — public URL editor + View public page (not on My Page). Copy: share your page so others can join your personal community.

2. **My Page** (public page editor)
   - Required first.
   - Landing copy + run photo (+ optional profile avatar) via `gofast_with_me` / athlete profile.
   - Page copy only — no Public URLs pile, no View as member, no My Community teaser.
   - Strangers decide to follow from `/u/[handle]` and `runner…/{handle}`; **What I'm training for** hydrates from goal/plan on the live page.

3. **My Community** (personal community — host side)
   - Messages — journey announcements (`gofast_container_messages`, topic `updates`)
   - Followers — list hydrated from `/container/members` on load
   - **View as member** link to `/container/[handle]`
   - Member view of the same community: `/container/[handle]` (training-for, plan strip, messages, thinking, followers; My Runs v2 collapsed).

4. **My Plan** (publish / share)
   - Publish/toggle active GoFast plan (`training_plans` public fields)
   - Owns plan publish — not buried inside My Community

5. **My Content** (CMS stub)
   - Tips, myRunRoutes, Blog — athlete-scoped CMS capability (`athlete_tips`, etc.)
   - Editors deferred; stub panel lists planned models

6. **Public door composition** (live `/u` + runner host)
   - Slim banner: avatar, name, handle, location, one **GoFast with {FirstName}** CTA.
   - Body: club-style **2/3** run photo + welcome / about / what you'll see; **1/3** Training for + See my plan + On the calendar.
   - Plan week strip and Activity/last Garmin run stay off the door (hub / member room).

Race-hub analogy: join door → member room with plan + messages. GWM: follow door → `/container/[handle]` room; host edits from **My Community**, **My Plan**, and **My Content** in studio.

### Boundaries (keep sharp)

- **GoFast With Me** = personal creator + audience following a goal and shared plan.
- **Run Club** = organization schedule, brand, multi-leader ops — stays in club leader / club hub.
- Club contrast: club = "see you Saturday." GoFast With Me = "training for MCM on this plan — join my journey."
- An athlete who leads a club can use both; GoFast With Me must not become a backdoor club admin.

### Ownership (FK clarity)

| Surface | Owns the data |
|---------|---------------|
| What I'm training for | Athlete goal / plan race link / race registry |
| Plan strip / My plan | `training_plans` (`planId`, public fields) |
| Messages | `gofast_container_messages` (`containerAthleteId`) |
| Followers | `gofast_container_memberships` via `/container/members` |
| Thinking | `athlete_tips` (etc.) — later |
| My Runs (v2) | `city_runs.athleteGeneratedId` |
| Door copy | `gofast_with_me` only |

Legacy table names (`gofast_container_*`) remain in schema; product language is **GoFast With Me**.

### Deferred CMS (My Content bin)

Tips, myRunRoutes, and Blog live under **My Content** — athlete-scoped CMS capability (`athlete_tips`, etc.). Editors are deferred; the bin shows planned models. Do not highlight before Landing basics are complete.

## What Not To Build

Do not build these:

- No staff/team setup in this GoFastWithMe flow.
- No separate GoFastWithMe module table for plan/run configuration.
- No fake "container config" on `gofast_with_me`.
- No plan metadata duplicated onto `gofast_with_me`.
- No separate vague `General Content` top-level item that competes with CMS.
- No UI that highlights CMS content types before the required Landing Page basics.
- No pretending current `gofast_container_messages.topic = tips` is the full CMS tips/blog/course system.
- No treating Tips, myRunRoutes, and Blog as out-of-scope forever; they are CMS capability — `athlete_tips` is the first table back.
- No flow where the user is warned to finish Landing Page but shown another active panel.
- No treating the public landing page as the real app container.
- No Run Club management inside the athlete container (series ops, club roster, club announcements).
- No full RunCrew product inside the athlete container.
- No container-native RSVP/check-in — reuse GoRun for hosted runs.
- No absorbing private athlete training (Garmin, private plans) into the social container except publish/share slices.

## Naming Guidance

Use product language that matches the data:

- **GoFast With Me** — product name for the follower hub and studio (not "athlete container").
- **My Page** — public page (`/u/[handle]`). User-facing: "page", not "door".
- **My Community** — personal community (messages + followers; host panel + `/container/[handle]` for followers). User-facing: "community", not "room".
- **My Plan** — publish/share training plan (`training_plans` public fields); studio sidebar peer.
- **My Content** — CMS stub for Tips, routes, Blog; studio sidebar peer.
- **Messages**, **Followers** — sections inside My Community.
- **What I'm training for** — goal/race on page + hub header (`GoalRaceCard`).
- **Plan strip** — training week in the member hub.
- **My Runs (v2)** — demoted manual hosted runs; not the primary loop.
- "Follow" / "followers" in member UX.
- "View as member" for `/container/[handle]`.
- "Share your page" — share so others can join your personal community.
- Internal code may still say door/room (`DoorSidebar`, front-door bridge helpers); product UI should not.

Avoid language that implies GoFastWithMe owns everything. It does not. GoFastWithMe introduces the athlete; the athlete hydrates the experience.
