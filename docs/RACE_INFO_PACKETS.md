# Race Info Packets

Time-aware race information services that expose **packets** of race data instead of dumping athletes into a monster race page or generic "see details" links.

## Problem

Race data is authored in GoFastCompany (wizard + ingest) and synced to MVP `race_registry`, but consumer surfaces still treat it as one blob:

- Mobile home swaps to "See race instructions" during race week, but it opens the same race prep screen.
- Race hub info tab shows logo + description + registration link.
- Public web renders the full race page (fine for SEO; not ideal for contextual athlete UX).

## Service model

`buildRaceInfoPackets()` in [`lib/races/race-info-packets.ts`](../lib/races/race-info-packets.ts) maps existing fields into typed packets:

| Packet | When | Source |
|--------|------|--------|
| `registration` | Not signed up | `registrationUrl`, open/close dates, fee |
| `course` | Course data exists | `courseSlug`, `courseMapUrl`, `course_segments` |
| `trainingTips` | Signed up + plan or segment tips | `training_plans`, `course_segments.runTip`, goal time |
| `packetPickup` | Pickup data exists; visible only ≤7 days | `packetPickup*` flat sync from expo |
| `arrival` | Logistics exist; visible only ≤7 days, emphasized ≤3 days | `logisticsInfo`, `gearDropInstructions`, `spectatorInfo` |
| `raceDayGuide` | Signed up + race week | Composite of start time, pickup, arrival |

Field inventory: [`lib/races/race-info-field-inventory.ts`](../lib/races/race-info-field-inventory.ts)

Before race week, signed-up athletes should see `trainingTips` and `course` first. Race-week logistics intentionally stay hidden until 7 days out because they are not useful enough to compete with training work earlier.

## API

```
GET /api/race-registry/[id]/info-packets
Authorization: Bearer <firebase>
```

Response:

```json
{
  "success": true,
  "raceRegistryId": "...",
  "raceDate": "...",
  "daysUntilRace": 4,
  "phase": "raceWeek",
  "isSignedUp": true,
  "primaryPacketKind": "raceDayGuide",
  "packets": [ /* visible packets sorted by priority */ ]
}
```

Loader: [`lib/races/load-race-info-packets.ts`](../lib/races/load-race-info-packets.ts)

## Content vs packets (blog pipeline)

These are **separate concerns**:

| | Race info packets | Race blog generation |
|--|-------------------|----------------------|
| Purpose | Contextual athlete UX (home, hub, prep) | Editorial / SEO long-form |
| Source | Structured registry + segments + athlete state | AI draft from race context |
| Storage | Computed at read time (no new table) | `blog_posts` draft rows |
| Wizard UI | N/A (data from existing steps) | Top-bar **Build content…** dropdown in `RaceManageEditor` |
| Publish path | Immediate via registry sync | Manual publish in blog editor |
| Public race page | Not required | Standalone blog pages only |

Blog types (`race-blog-service.ts`):

- `why-this-race` — marketing highlights
- `race-day-guide` — prose logistics article (overlaps packet data but not structured)
- `course-breakdown` — mile-by-mile narrative

**Training tips packet** uses structured `runTip` on course segments and live training plan state — not blog drafts.

### Future wizard affordance

`Build content…` exists today as a top-bar dropdown (not a wizard step). A future **Content** checklist step could:

1. Show packet completeness (pickup filled? arrival filled? segments with tips?)
2. Offer blog generation as optional editorial output
3. Not block prodpush or athlete packets

## Client consumption

Mobile:

- `lib/race-info-packets.ts` — fetch helper
- `components/races/RaceInfoPackets.tsx` — renders packet cards
- Home race-week CTA → race prep with `focusPacket` param
- Race prep + hub info tab render packets instead of flat logistics sections

Web MVP can adopt the same API for race hub and myrace pages without schema changes.

## Gaps / next sync improvements

- Structured `race_arrival_items` from Company are not on MVP registry yet; arrival packet uses flat fields.
- Full expo schedule / operating hours not synced; packet pickup uses legacy flat fields.
- Blog drafts are not linked to packets; optional resolver could attach published `course-breakdown` blog later.
