# coachPlanOverview — logic stub (parked)

**Status:** Document only. No refactor planned yet.

`coachPlanOverview` is a nullable **JSON column** on preset rows (`training_plan_preset`, `athlete_presets`, swim presets). One blob, multiple jobs depending on who owns the preset.

---

## Staff presets (canonical shape)

Typed in [`lib/training/preset-strategy.ts`](../lib/training/preset-strategy.ts) as `CoachPlanOverview`:

| Field | Purpose |
|-------|---------|
| `summary` | Coach-facing plan narrative |
| `weeklyVolume` | Min/max peak weekly miles |
| `weeklyWorkoutComposition` | Sessions per week: easy, tempo, intervals, long run + `cadenceWeeks` |
| `*Structure` | Intent + structure family per run type |

**Consumers:** plan generation (`execute-plan-generate`, `assign-workout-days`) reads composition to decide how many tempo/interval slots to place each week (clamped 0–1 per type today).

**Merge helper:** [`mergeCoachPlanOverview`](../lib/training/athlete-preset-coach-overview.ts) — shallow patch into existing JSON.

---

## Athlete presets (create your own) — overloaded same column

Athlete presets **reuse** `coachPlanOverview` for two extra concerns that staff presets don’t use the same way:

### 1. AI foundation output (after cups / core infer)

Written when athlete confirms foundation or on preset create. Includes:

- `weSeeYou`, `barriers`
- `progressionAggressiveness` (CONSERVATIVE | MODERATE | AMBITIOUS)
- `weeklyVolumeBand` (FINISH | RACE | ELITE)
- `minWeeklyMiles`, `maxWeeklyMiles`
- Calendar preview: `peakLongRunDate`, `taperStartDate`, `poolMilesByCycle`, `totalWeeks`, `peakPoolKey`

Source: [`coachOverviewFromCoreInfer`](../lib/training/athlete-preset-coach-overview.ts) + infer in [`athlete-preset-core-service.ts`](../lib/training/athlete-preset-core-service.ts).

Also copied/cloned from staff template via [`seedWorkoutBlueprintFromSource`](../lib/training/clone-preset-configs.ts) (`weeklyWorkoutComposition`, etc.) when rotations are set up.

### 2. Builder progress flags (wizard resume)

Boolean flags merged on PATCH in [`app/api/athlete-presets/[id]/route.ts`](../app/api/athlete-presets/[id]/route.ts). Read by [`builderProgressFromOverview`](../lib/training/athlete-preset-builder-progress.ts):

| Flag | Set when |
|------|----------|
| `cupsConfirmed` | Foundation / core cups locked |
| `longRunConfirmed` | Long-run 4-week order confirmed |
| `easyConfirmed` | Easy auto-confirmed at seed (not shown in UI) |
| `tempoPicked` | Athlete saved tempo catalogue selection (1–8) |
| `tempoConfirmed` | Tempo rotation order confirmed |
| `intervalPicked` | Athlete saved interval catalogue selection |
| `intervalConfirmed` | Interval rotation order confirmed |
| `adjusterConfirmed` | Pace adjuster saved; preset complete |

**Build step resolution:** [`athletePresetBuildStep`](../lib/training/athlete-preset-blueprint.ts) walks these flags + FK presence (`longRunConfigId`, etc.) to decide resume step.

**Tempo/interval sub-phases:** `tempoPicked` → show rotation order; not picked → show catalogue picker ([`qualityStepSubPhase`](../lib/training/athlete-preset-builder-progress.ts)).

---

## What is NOT in coachPlanOverview

Actual rotation contents live elsewhere:

| Data | Storage |
|------|---------|
| Long run / easy order | Shared staff configs + `athlete_preset_*_order` overlay rows |
| Tempo / interval picks + order | `athlete_tempo_config` / `athlete_intervals_config` + position rows → `catalogueWorkoutId` |
| Pace nudges | `athlete` row pace adjuster columns |

`coachPlanOverview` only records **that** those steps happened and **strategy/band** context — not which catalogue IDs were chosen.

---

## API touchpoints (athlete)

- `POST /api/athlete-presets` — initial overview from infer + template seed
- `PATCH /api/athlete-presets/[id]` — `mergeCoachPlanOverview` on each builder action
  - `saveSelection` (tempo/interval) → sets `*Picked` only
  - `confirm` (tempo/interval/adjuster) → sets `*Confirmed`

---

## Known awkwardness (why this doc exists)

- Name implies “coach plan strategy”; athlete rows also store wizard state and AI copy in the same JSON.
- Staff typed `CoachPlanOverview` requires `summary`; athlete blobs may not satisfy `parseCoachPlanOverview` even when valid for the builder.
- Progress flags could move to dedicated columns or a `builderProgress` JSON field later — parked until a migration is worth it.

---

## Related files

- Strategy types: `lib/training/preset-strategy.ts`
- Merge + infer shape: `lib/training/athlete-preset-coach-overview.ts`
- Builder progress: `lib/training/athlete-preset-builder-progress.ts`
- Step gating: `lib/training/athlete-preset-blueprint.ts`
- UI: `components/training/AthletePresetBuilder.tsx`
