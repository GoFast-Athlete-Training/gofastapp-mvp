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

## The Crucial Product Fork

The product must keep two surfaces clear:

1. Landing page
   - This is the public "who am I?" surface.
   - It combines GoFastWithMe CMS content with athlete-scoped public data.
   - It helps strangers understand the athlete and decide to follow/join.
   - It is not the monetizable relationship layer by itself.

2. Container
   - This is how the athlete engages fans/followers.
   - This is where the audience relationship lives.
   - This is where followers, member feed, announcements, training plan access, and future monetization belong.
   - If the container is buried behind the landing page, the product loses the actual audience/monetizer layer.

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

- Use `myRunRoutes` for athlete-authored running routes so it is not confused with Next.js/API routes.
- Use GoFastWithMe-scoped table names such as `gofast_with_me_tips`, `gofast_with_me_my_run_routes`, and `gofast_with_me_blog_posts`.
- Keep container feed topics separate from durable CMS content.

## MVP1 Studio Areas

Use names that match the fork:

1. `GoFastWithMe CMS`
   - Controls the landing page and public content.
   - Landing content: public copy, page photo, athlete intro, and athlete-scoped "who am I?" content.
   - Production CMS content types: Tips, myRunRoutes, and Blog.
   - CMS content can appear on the landing page and can also feed the container/member experience when explicitly designed.
   - Historical note: `20260718120000_gofast_pages` introduced `athlete_tips` and `gofast_page_routes`, but `20260718140000_gofast_with_me_refactor` dropped those CMS tables when `gofast_pages` became `gofast_with_me`.
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
- `athlete_tips` and `gofast_page_routes` existed briefly, then were intentionally dropped from v1 in the GoFastWithMe refactor.
- `gofast_page_routes` was about running routes (`routes` model), not app/page routing.
- `gofast_container_messages` supports a `tips` topic, but that belongs to the member container feed.
- Blog does not appear as a current first-class GoFastWithMe CMS model in this repo.
- Tips and myRunRoutes should be restored as GoFastWithMe CMS capability, but not under the old `athlete_tips` / `gofast_page_routes` naming.
- CMS content should be modeled deliberately as GoFastWithMe child concepts, not resurrected under the old names by accident.
- CMS content should FK to `Athlete.id` for ownership/authorship; optional links to `gofast_with_me` can describe placement on the public GoFastWithMe surface.

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
  -> hydrate members, feed, hosted runs, first published public plan
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

The studio should lead the user through what actually matters:

1. `GoFastWithMe CMS`
   - Required first.
   - This includes the landing page and public content types.
   - Landing is the public door.
   - It edits the GoFastWithMe public copy/photo.
   - It should grow to manage courses, tips, and blog content.
   - It may display athlete-scoped context, but it does not own the container.

2. `GoFastWithMe Add My Plan`
   - Next after CMS/Landing.
   - This should reflect attachable/hydrated athlete-owned modules.
   - For MVP, the core setup is the training plan/public plan path.
   - It should hydrate the active `planId` from `Athlete.id`.
   - It should expose plan public toggle/publish state.
   - It should expose public plan description editing.
   - Hosted runs are optional setup if the athlete wants to show a run they are doing.
   - Do not add staff/team setup here.

3. CMS content types
   - Tips.
   - myRunRoutes.
   - Blog.
   - All three are athlete-scoped creator content.
   - These belong under CMS, not as a confusing separate "General Content" sibling.
   - They should not be highlighted before CMS/Landing basics are complete.
   - Do not confuse CMS tips with container feed `tips`; one is durable public content, the other is an audience post topic.
   - Do not call running-route content just `routes`; use `myRunRoutes`.

4. `GoFastWithMe Member Manager`
   - Owner/manager controls for the athlete-owned container.
   - Followers, announcements, hub feed controls.
   - This is the "view/manage as owner" side.
   - This is how the athlete speaks and shares with their specific audience.

5. `View as member`
   - Link to `/container/[handle]`.
   - This is the follower/member experience.
   - It hydrates by host athlete id.

## What Not To Build

Do not build these:

- No staff/team setup in this GoFastWithMe flow.
- No separate GoFastWithMe module table for plan/run configuration.
- No fake "container config" on `gofast_with_me`.
- No plan metadata duplicated onto `gofast_with_me`.
- No separate vague `General Content` top-level item that competes with CMS.
- No UI that highlights CMS content types before the required Landing Page basics.
- No pretending current `gofast_container_messages.topic = tips` is the full CMS tips/blog/course system.
- No restoring `athlete_tips` / `gofast_page_routes` under old names without revisiting the tightened GoFastWithMe model.
- No treating Tips, myRunRoutes, and Blog as out-of-scope forever; they are the CMS capability that needs to come back.
- No flow where the user is warned to finish Landing Page but shown another active panel.
- No treating the public landing page as the real app container.

## Naming Guidance

Use product language that matches the data:

- "GoFastWithMe CMS" for the public landing page controls.
- "GoFastWithMe Add My Plan" for attaching or publishing the athlete-owned active training plan.
- "Tips", "myRunRoutes", and "Blog" for CMS content types.
- "GoFastWithMe Member Manager" for owner controls, followers, announcements, and audience communication.
- "View as member" for `/container/[handle]`.
- "View public page" for the public landing route.

Avoid language that implies GoFastWithMe owns everything. It does not. GoFastWithMe introduces the athlete; the athlete hydrates the experience.
