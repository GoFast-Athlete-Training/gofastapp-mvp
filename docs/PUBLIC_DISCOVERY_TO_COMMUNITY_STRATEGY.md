# Public Discovery → App Community Strategy

## The split

GoFast has three distinct run-club surfaces. They must not share names or mental models.

| Surface | Repo | Auth | Purpose |
|---|---|---|---|
| **Public discovery** | `gofast-contentpublic` | None | SEO, brand awareness, acquisition |
| **Run-first app** | `gofastapp-mvp` | Firebase | Find/join runs today |
| **Future club/community hub** | `gofastapp-mvp` | Firebase | Join a club/team, then see runs, announcements, events |

**GoFastCompany** owns data, workflows, website configs, and admin tools — not public rendering.

## Public web (today)

Pre-auth surfaces are **discovery and acquisition**, not membership containers.

- Directory cards → `/runclub/[slug]` (**ClubPublicDiscoveryView**)
- Run cards → `/runs/[slug]` (web-native detail)
- Soft CTA: “Get GoFast” / “Open in GoFast” — not RSVP-first UX
- Goal: “This club looks interesting” → download or open app

We do **not** expect most users to “join a run” on the web. Auth gymnastics on public pages are out of scope.

## App (today): run-first

Current authenticated experience is **run-first**:

- Athlete opens GoFast to find and join runs
- Clubs appear as context/sponsorship around runs (“who’s sponsoring this run”)
- `/runclub/[slug]` in the app is post-auth membership/join/leave, announcements, events — **AuthenticatedRunClubHubPage**
- This is **not** the same as the public SEO club page

## App (future): club/community-first

A later pass adds stickiness without clobbering run-first:

- Join or follow a club/team/community
- Then see its runs, series, announcements, member state
- Social layer (announcements, events) lives here — not on public web

**Training** stays on athlete home. It is not the organizing metaphor for club/community.

## Data flow (public club click-through)

```
Directory card
  → GET /api/runclub/by-slug/[slug]     (GoFastCompany acq_run_clubs)
  → GET /api/runs/by-runclub/[slug]     (gofastapp-mvp prod runs)
  → ClubPublicDiscoveryView             (gofast-contentpublic)
       → RunCard grid → /runs/[slug]
       → soft app acquisition CTA
```

## Naming canon

| Old / confusing | New / correct |
|---|---|
| `PublicRunClubContainer` (contentpublic) | `ClubPublicDiscoveryView` |
| `RunClubContainerPage` (app) | `AuthenticatedRunClubHubPage` |
| `PublicRunClubContainer` (Company demo) | **Removed** — public rendering lives in contentpublic only |
| `DemoRunClubContainer` | **Removed** — stale fake demos burned down |

## What we removed (Club Surface Reset pass)

- GoFastCompany fake public run club pages and demo runcrew surfaces
- contentpublic `fakeclub`, fake directory hydration, demo run pages
- Deprecated public fields in payloads: `vibe`, `experienceLevel`, `runSchedule` string fallback

DB columns for deprecated fields may remain; public payloads and renderers no longer use them.

## Principles for future work

1. **Do not duplicate public UI in Company** — link to contentpublic URLs.
2. **Do not put membership/join/leave on public web** — that is app/community pass.
3. **Do not rebuild fake demos** — use real published clubs and runs for previews.
4. **When adding community features**, extend authenticated app surfaces; keep public web thin.
