# GoFastWithMe Follow Bridge Architecture

## Summary

- **GoFastWithMe** (`gofast_with_me`) is the public landing identity row, owned by `athleteId`.
- **Follow** targets the **owner athlete**, not the GoFastWithMe row.
- **Implementation today:** `gofast_container_memberships` (athlete-to-athlete junction).
- **User-facing name:** Follow / followers — not container/community.

## Public hydration

[`lib/server/load-public-athlete-page.ts`](../lib/server/load-public-athlete-page.ts):

1. Resolve handle via `getGoFastWithMeBySlug(handle)`.
2. Load `gwmRow.athlete` as owner.
3. Return `gofastWithMe`, modules, and `publicActions`.

Follow CTA is derived in [`lib/gofast-with-me/resolve-public-actions.ts`](../lib/gofast-with-me/resolve-public-actions.ts) when a public GoFastWithMe slug exists.

## Membership model (current DB)

```prisma
model gofast_container_memberships {
  containerAthleteId String  // athlete being followed
  memberAthleteId    String  // follower
}
```

`Athlete.isGoFastContainer` is a legacy flag; publish/follow auto-enables it via [`lib/gofast-with-me/follow-service.ts`](../lib/gofast-with-me/follow-service.ts).

## Product flow

```text
Public GoFastWithMe → Follow {Name} CTA → /follow/{slug}
  → explainer
  → if authed: POST /api/follow/{slug} → membership + app surface
  → if not authed: signup with intent → return to /follow/{slug}
```

## Routes

| Route | Purpose |
|---|---|
| `/follow/[handle]` | Public explainer + follow confirm |
| `POST /api/follow/[handle]` | Auth: upsert follower membership |
| `/container/[handle]` | Authenticated member hub (UI: **Following {Name}**) |
| `GET /api/athlete/[id]/container/hub` | Boot payload for member hub |

## Member hub (`/container/[handle]`)

After follow, members land on the **Following {Name}** hub:

| Section | Source |
|---|---|
| Training week | Host's first published public plan → `PublicPlanWeekViewer` |
| This week's runs | Custom week strip from upcoming hosted runs when no published plan |
| Feed (topical) | `gofast_container_messages` with `topic` |
| Upcoming runs | Public hydrate when plan week is shown |
| Followers | `gofast_container_memberships` |

### Topical feed topics

Defined in [`lib/gofast-with-me/container-topics.ts`](../lib/gofast-with-me/container-topics.ts):

| Topic | Who posts (MVP) |
|---|---|
| `updates` | Host only |
| `tips` | Host only |
| `nutrition` | Host only |
| `routes` | Host only (optional `routeId` FK to `routes`) |
| `chatter` | Host + followers |

Messages API: `GET/POST /api/athlete/[id]/container/messages?topic=...`

Hub boot: [`lib/gofast-with-me/container-hub-service.ts`](../lib/gofast-with-me/container-hub-service.ts)

UI: [`components/gofast-with-me/GoFastWithMeHubFeed.tsx`](../components/gofast-with-me/GoFastWithMeHubFeed.tsx)

## Owner studio (`/gofast-with-others`)

The owner dashboard is ordered:

| Order | Area | Component | Purpose |
|---|---|---|---|
| 1 | Welcome Content | `GoFastWithMeWelcomePanel` | Who You Are — landing identity; green when welcome, bio, whatYoullSee, and photo are filled |
| 2 | Configure | `GoFastWithMeSetupPanel` | Connect/publish training plan and runs |
| 3 | General Content | `GoFastWithMeContentPanel` | Public module stubs, insights/tips pointers |
| 4 | Manage | `GoFastWithMeMemberManagementPanel` | Followers, announcements, member hub |

First-time users with incomplete Welcome Content land on `#welcome` automatically.

Shell: [`GoFastWithOthersDashboard.tsx`](../components/gofast-with-me/GoFastWithOthersDashboard.tsx)  
Sidebar nav: [`GoFastWithMeStudioSidebar.tsx`](../components/gofast-with-me/GoFastWithMeStudioSidebar.tsx)  
Section helpers: [`studio-sections.ts`](../components/gofast-with-me/studio-sections.ts)

Configure status uses `GET /api/me/share-hub-status` and [`share-creator-card-logic.ts`](../lib/profile/share-creator-card-logic.ts).

## Next pass (deferred)

- Rich “what you’ll experience” explainer (paid coaching).
- Rename product layer from container → follow hub in routes/DB.
- Wire container into global chatter inbox (`lib/chatter-channels.ts`).
- Route picker UI on `#routes` posts.
- App download + search-by-handle fallback for lost intent.
