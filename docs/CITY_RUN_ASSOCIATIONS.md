# City run associations — container vs partner

**The question this answers:** city runs went universal, so anyone can create one.
A run can now point at a race, a club, a brand, a store, a special event, a crew,
or an athlete. Which of those owns the run? Do we keep adding columns as new
kinds show up? And when a shakeout also has a club and a brand on it, where do
those go?

**The answer:** stop asking which column owns the run and ask which *position*
the row is in. Every `city_runs` row has exactly one **container** and any number
of **partners**. The columns we already have are the right shape for the
container. They are the wrong shape for partners, and that is the part still
worth building.

Canon lives in [`lib/city-run/run-affiliations.ts`](../lib/city-run/run-affiliations.ts).

---

## Container — exactly one, decides behavior

The container is the entity that owns the run. It sets `city_runs.cityRunType`,
which gates product behavior: check-in, reminders, look-back, and which hub the
run belongs to.

| Precedence | Container | Id column | `cityRunType` |
| --- | --- | --- | --- |
| 1 | Race | `raceRegistryId` (or `shakeoutDedupeKey` pre-link) | `RACE_SHAKEOUT` |
| 2 | Special event | `specialEventId` | `SPECIAL` |
| 3 | Run store | `runStoreId` | `RUN_STORE` |
| 4 | Run club | `runClubId` | `CLUB` |
| 5 | Run crew | `runCrewId` | `RUN_CREW` |
| 6 | Athlete | `athleteGeneratedId` | `INDIVIDUAL` |
| — | none | — | `OTHER` |

Two rules make this unambiguous:

- **A stored `cityRunType` names the container.** Staff picked it on purpose, and
  a club-hosted run may still carry a race tag. Only when the column is empty
  (legacy rows, machine sync) do we fall back to precedence.
- **Highest precedence wins the fallback.** A run with a race, a club, and a
  store is a race shakeout. The club and store did not stop existing — they moved
  into partner positions.

`resolveCityRunType` delegates to this table, so staff create, Company sync, and
athlete reads cannot drift apart.

### Brand is never a container

There is no `BRAND` container and no `BRAND` value in `CityRunType`. A
brand-*led* run is a `special_events` row with `brandId` set, and the run bolts
to the event. `city_runs.runBrandId` is always a partner stamp. This is already
how [`RunManageRunAffiliations`](../components/runmanage/RunManageRunAffiliations.tsx)
describes it to staff ("brand is an optional stamp"); the resolver now agrees.

---

## Partners — any number, attribution only

Everything affiliated that is not the container is a partner. Partners never
change behavior; they render as logos, names, and links.

Partners come from two places:

- **Lead slots** — `runBrandId`, `runStoreId`, `runClubId`. Real foreign keys,
  indexed, one per kind. A lead slot becomes a partner whenever a
  higher-precedence container owns the run.
- **`partnerExtras`** — a JSON array of `{ kind, refId, nameSnapshot,
  logoUrlSnapshot }` for the overflow (a second co-host club, a third sponsor).

`resolveCityRunPartners` merges both, drops the container so it is never listed
twice, and dedupes by `kind + refId`, so a club in both `runClubId` and
`partnerExtras` appears once.

---

## Reading a run

Add [`CITY_RUN_AFFILIATION_SELECT`](../lib/city-run/run-affiliations.ts) (or
`CITY_RUN_AFFILIATION_INCLUDE` for queries that use `include`) to a `city_runs`
query, then hand the row to `serializeCityRunAffiliations`. One query, no extra
round trips. Every consumer gets the same block:

```ts
{
  cityRunType: "RACE_SHAKEOUT",
  container: { kind: "RACE", label: "Race", id, name, subtitle, logoUrl, websiteUrl, href },
  partners: [{ kind: "BRAND", slot: "lead", label: "Brand", id, name, logoUrl, ... }],
}
```

`name` is null when the relation was not selected — callers still get the id
instead of a compile error. `partnerExtras` entries fall back to their
snapshots, which is the only reason they render at all today (see below).

Wired into:

- `GET /api/runs/[runId]` — the athlete run page
- `GET /api/runs/manage/[runId]` — the staff editor
- `serializeHubShakeout` — race hub shakeout lists, staff and athlete

---

## Writing a run

`validateCityRunAffiliationRefs` is the single write gate. It checks the shape
(an explicit `cityRunType` must have its container id) and that every referenced
row actually exists, so a stale id answers `400` naming the bad reference instead
of surfacing as an opaque foreign-key `500`.

Wired into `POST /api/runs/create`, `PUT /api/runs/[runId]`, and the Company
shakeout create.

---

## Still open

### 1. Partners are not a real relation

`partnerExtras` is untyped JSON with no foreign key, no index, and name/logo
snapshots that go stale when the brand or club is renamed. The consequences:

- **Reverse lookups only see lead slots.** "Every run this brand sponsored"
  works for `runBrandId` (indexed) and silently misses anything in
  `partnerExtras`. There is no such query in the codebase yet, which is why the
  gap has not bitten.
- **No referential integrity.** Deleting a brand leaves its `refId` behind.
- **Snapshots drift.** A renamed club keeps its old name on old runs.

The fix is a junction table, not more columns:

```prisma
model city_run_partners {
  id        String          @id @default(cuid())
  cityRunId String
  kind      RunPartnerKind  // BRAND | STORE | CLUB
  /// Exactly one of these is set, matching `kind`.
  brandId   String?
  storeId   String?
  clubId    String?
  /// `lead` keeps the single-primary-per-kind UX; `extra` is the overflow.
  slot      String          @default("extra")
  createdAt DateTime        @default(now())

  @@unique([cityRunId, kind, brandId, storeId, clubId])
  @@index([brandId])
  @@index([storeId])
  @@index([clubId])
}
```

Migration path, additive at every step:

1. Add the table. Keep `runBrandId` / `runStoreId` / `runClubId` as the lead
   slots — they are load-bearing for container resolution and every existing
   reverse lookup.
2. Backfill one row per `partnerExtras` entry, resolving each `refId` against
   its table and dropping entries that no longer resolve.
3. Have `resolveCityRunPartners` read the junction rows instead of the JSON,
   with the lead columns still supplying the lead slots.
4. Stop writing `partnerExtras`; leave the column until nothing reads it.

Until step 3, treat `partnerExtras` as display-only: safe to render, not safe to
query.

### 2. Race shakeouts and special events have no check-in lifecycle

`hasSocialRunLifecycle` allows `CLUB`, `INDIVIDUAL`, `RUN_CREW`, and
`RUN_STORE`. So a `RACE_SHAKEOUT` run collects RSVPs through the race hub but
`/gorun/[runId]` will not offer check-in for it, and `SPECIAL` runs get neither.
That is a product decision, not a modelling one, but it is now the most visible
consequence of picking a container — worth settling before more shakeouts ship.

### 3. `CityRunPartnerPanel` encodes the old model

[`components/runmanage/CityRunPartnerPanel.tsx`](../components/runmanage/CityRunPartnerPanel.tsx)
treats store and brand as mutually exclusive — attaching one nulls the other.
Under this canon they are independent partner slots. The component is currently
unreferenced, so it is not causing data loss; rewrite or delete it before wiring
it up.
