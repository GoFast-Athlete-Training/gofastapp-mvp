# RunCrew Foreign Key Relations Analysis

**Date:** 2025-01-XX  
**Purpose:** Map all FK relations from RunCrew model to identify hydrate "boxes"

---

## RunCrew Model (Base)

```prisma
model RunCrew {
  id          String  @id @default(cuid())
  name        String
  description String?
  joinCode    String  @unique
  logo        String?
  icon        String?
  isArchived Boolean   @default(false)
  archivedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // FK Relations (direct children)
  memberships   RunCrewMembership[]
  messages      RunCrewMessage[]
  announcements RunCrewAnnouncement[]
  runs          RunCrewRun[]
  events        RunCrewEvent[]
  managers      RunCrewManager[]      // DEPRECATED
  joinCodes     JoinCode[]
}
```

---

## Direct FK Relations (RunCrew → Child Models)

### 1. `memberships` → RunCrewMembership[]

**FK Field:** `runCrewId` in `RunCrewMembership`

```prisma
model RunCrewMembership {
  id        String      @id @default(cuid())
  runCrewId String      // FK to RunCrew
  athleteId String      // FK to Athlete
  role      RunCrewRole @default(member)
  joinedAt  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  runCrew RunCrew @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  athlete Athlete @relation("AthleteRunCrewMemberships", fields: [athleteId], references: [id], onDelete: Cascade)
}
```

**Child Relations:**
- `athlete` (Athlete) - selected fields only

**Box Name:** `membershipsBox`

---

### 2. `messages` → RunCrewMessage[]

**FK Field:** `runCrewId` in `RunCrewMessage`

```prisma
model RunCrewMessage {
  id        String @id @default(cuid())
  runCrewId String // FK to RunCrew
  athleteId String // FK to Athlete
  content   String
  createdAt DateTime @default(now())

  runCrew RunCrew @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  athlete Athlete @relation(fields: [athleteId], references: [id], onDelete: Cascade)
}
```

**Child Relations:**
- `athlete` (Athlete) - selected fields only

**Box Name:** `messagesBox`

---

### 3. `announcements` → RunCrewAnnouncement[]

**FK Field:** `runCrewId` in `RunCrewAnnouncement`

```prisma
model RunCrewAnnouncement {
  id        String @id @default(cuid())
  runCrewId String // FK to RunCrew
  authorId  String // FK to Athlete (as author)
  title     String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  runCrew RunCrew @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  author  Athlete @relation("RunCrewAnnouncementAuthor", fields: [authorId], references: [id], onDelete: Cascade)
}
```

**Child Relations:**
- `author` (Athlete) - selected fields only

**Box Name:** `announcementsBox`

---

### 4. `runs` → RunCrewRun[]

**FK Field:** `runCrewId` in `RunCrewRun`

```prisma
model RunCrewRun {
  id          String @id @default(cuid())
  runCrewId   String // FK to RunCrew
  createdById String // FK to Athlete (as creator)
  title       String
  runType     String @default("single")
  date        DateTime
  startTime   String
  timezone    String?
  meetUpPoint String
  meetUpAddress String?
  meetUpPlaceId String?
  meetUpLat   Float?
  meetUpLng   Float?
  recurrenceRule String?
  recurrenceEndsOn DateTime?
  recurrenceNote String?
  totalMiles  Float?
  pace        String?
  stravaMapUrl String?
  description String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  runCrew   RunCrew          @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  createdBy Athlete          @relation("RunCrewRunCreator", fields: [createdById], references: [id], onDelete: Cascade)
  rsvps     RunCrewRunRSVP[] // Child relation
}
```

**Child Relations:**
- `createdBy` (Athlete) - selected fields only
- `rsvps` (RunCrewRunRSVP[]) - includes `athlete` relation

**Box Name:** `runsBox`

---

### 5. `events` → RunCrewEvent[]

**FK Field:** `runCrewId` in `RunCrewEvent`

```prisma
model RunCrewEvent {
  id          String @id @default(cuid())
  runCrewId   String // FK to RunCrew
  organizerId String // FK to Athlete (as organizer)
  title       String
  date        DateTime
  time        String
  location    String
  address     String?
  description String?
  eventType   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  runCrew   RunCrew            @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  organizer Athlete            @relation("RunCrewEventOrganizer", fields: [organizerId], references: [id], onDelete: Cascade)
  rsvps     RunCrewEventRSVP[] // Child relation
}
```

**Child Relations:**
- `organizer` (Athlete) - selected fields only
- `rsvps` (RunCrewEventRSVP[]) - includes `athlete` relation

**Box Name:** `eventsBox`

---

### 6. `managers` → RunCrewManager[] (DEPRECATED)

**FK Field:** `runCrewId` in `RunCrewManager`

```prisma
// DEPRECATED — do not write new data
// Role information is now stored in RunCrewMembership.role
model RunCrewManager {
  id        String @id @default(cuid())
  runCrewId String // FK to RunCrew
  athleteId String // FK to Athlete
  role      String
  createdAt DateTime @default(now())

  runCrew RunCrew @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  athlete Athlete @relation("RunCrewManager", fields: [athleteId], references: [id], onDelete: Cascade)
}
```

**Status:** ❌ DEPRECATED - Should NOT be included in hydrate boxes

---

### 7. `joinCodes` → JoinCode[]

**FK Field:** `runCrewId` in `JoinCode`

```prisma
model JoinCode {
  id        String    @id @default(cuid())
  code      String    @unique
  runCrewId String    // FK to RunCrew
  runCrew   RunCrew   @relation(fields: [runCrewId], references: [id], onDelete: Cascade)
  createdAt DateTime  @default(now())
  expiresAt DateTime?
  isActive  Boolean   @default(true)
}
```

**Child Relations:** None (simple scalar fields)

**Box Name:** `joinCodesBox`

---

## Summary: Valid Hydrate Boxes

Based on FK relations, the valid boxes are:

1. ✅ **membershipsBox** → `RunCrewMembership[]` (includes `athlete`)
2. ✅ **messagesBox** → `RunCrewMessage[]` (includes `athlete`)
3. ✅ **announcementsBox** → `RunCrewAnnouncement[]` (includes `author`)
4. ✅ **runsBox** → `RunCrewRun[]` (includes `createdBy` + `rsvps` with `athlete`)
5. ✅ **eventsBox** → `RunCrewEvent[]` (includes `organizer` + `rsvps` with `athlete`)
6. ✅ **joinCodesBox** → `JoinCode[]` (scalar fields only)
7. ❌ **managersBox** → DEPRECATED, do not include

---

## Meta Box (RunCrew Scalar Fields)

```typescript
meta: {
  runCrewId: string,
  name: string,
  description?: string,
  joinCode: string,
  logo?: string,
  icon?: string,
  createdAt: DateTime,
  updatedAt: DateTime,
  isArchived: boolean,
  archivedAt?: DateTime
}
```

---

## Proposed Response Shape

```typescript
{
  meta: {
    runCrewId: string,
    name: string,
    description?: string,
    joinCode: string,
    logo?: string,
    icon?: string,
    createdAt: DateTime,
    updatedAt: DateTime,
    isArchived: boolean,
    archivedAt?: DateTime
  },
  membershipsBox: {
    memberships: RunCrewMembership[] // with athlete included
  },
  messagesBox: {
    messages: RunCrewMessage[] // with athlete included
  },
  announcementsBox: {
    announcements: RunCrewAnnouncement[] // with author included
  },
  runsBox: {
    runs: RunCrewRun[] // with createdBy + rsvps (with athlete) included
  },
  eventsBox: {
    events: RunCrewEvent[] // with organizer + rsvps (with athlete) included
  },
  joinCodesBox: {
    joinCodes: JoinCode[]
  }
}
```

---

## Reference Implementation (gofastfrontend-mvp1) Usage

### RunCrewCentralAdmin.jsx
- Uses: `crew.runs`, `crew.memberships`, `crew.announcements`, `crew.joinCode`
- Also loads: `leaderboard` (separate API call - not FK relation)
- Pattern: Single `/runcrew/${runCrewId}` call + separate `/runcrew/${runCrewId}/announcements` + `/runcrew/${runCrewId}/leaderboard`

### RunCrewCentral.jsx (Member View)
- Uses: `crew.runs`, `crew.announcements`, `crew.messages`, `crew.memberships`, `crew.joinCode`
- Also uses: `crew.leaderboardDynamic` (computed, not FK relation)
- Pattern: Single hydrate call returns all data

### Key Observations
1. ✅ `runs`, `announcements`, `messages`, `memberships` are all used in UI
2. ✅ `joinCode` is used (but it's a scalar field on RunCrew, not a box)
3. ❌ `events` - Not used in reference implementation
4. ❌ `joinCodes` (plural) - Not used (only `joinCode` scalar is used)
5. ❌ `leaderboard` - Not an FK relation, computed separately

---

## Notes

- All boxes are derived directly from Prisma FK relation names
- Child relations (like `rsvps` on runs/events) are included within the parent box
- `managers` is explicitly excluded as deprecated
- No invented abstractions or renamed relations
- Each box maps cleanly to one FK relation (or FK + immediate children)
- Reference implementation uses: `runs`, `announcements`, `messages`, `memberships`
- Reference implementation does NOT use: `events`, `joinCodes` (plural)
- `joinCode` (singular, scalar) belongs in `meta`, not a box

