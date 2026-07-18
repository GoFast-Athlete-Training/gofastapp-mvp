# Share with the Community — mobile follow-up

Web IA validated in gofastapp-mvp at `/profile/share`.

## Web hub (shipped)

Authenticated creator hub with four cards:

| Card | Primary route | Public destination |
|------|---------------|-------------------|
| GoFast With Me | `/profile/gofast-page` | `runner.gofastcrushgoals.com/{slug}` via `gofastSlugSnapshot` |
| Training plan | `/training/lead` | `/plans/{slug}` |
| Public run | `/host-a-run` | Run With Me upcoming runs + GoRun |
| RunCrew | `/runcrew/create` / `/my-runcrews` | Crew product (separate from Run With Me) |

Entry points: Profile sidebar, profile overview, Run With Me studio, Training hub panel, Community page.

## Mobile assessment (GoFast-mobile — not implemented)

**GoFast With Me studio** (`/profile/gofast-page`) is the home for athlete invite identity + page preview. **Share hub** (`/profile/share`) remains deferred — do not port as primary mobile flow until GoFast With Me is stable on web.

**Recommended first placement:** GoRun tab (`app/(tabs)/go-run.tsx`) — already the social hub with Discover runs, Build a run, My community runs.

**Secondary placement:** Profile (`app/profile.tsx`) — after handle is set, link to a native Share hub or deep link to web `/profile/share`.

**Do not merge into one mobile flow:** RunCrew, Container (`isGoFastContainer`), public runs, and published plans remain separate products with different APIs.

**Gaps to close before parity:**

- Run With Me studio and `isGoFastContainer` toggle (web-only today)
- Published training plan promote/preview (web `/training/lead`, `/plans/[slug]`)
- Share hub status API (`GET /api/me/share-hub-status`) can power a thin native shell

**Suggested mobile v1:** Four-action sheet on GoRun matching web card labels, opening existing native routes where they exist (`host-a-run`, `crew/create`) and authenticated web views for plan share + Run With Me studio until native UI is justified.
