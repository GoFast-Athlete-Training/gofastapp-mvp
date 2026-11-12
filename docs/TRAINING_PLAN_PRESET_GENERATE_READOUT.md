# What is on the preset, and what generate reads

Catalog generate uses `training_plans.presetId`. Athlete-owned blueprints (`athletePresetId`) are a separate path: they still carry pools, `coachPlanOverview`, and rotation FKs on `athlete_presets`. This doc is the **catalog preset** path after the `training_plan_preset` column cleanup (migration `20261109010000_training_plan_preset_column_cleanup`).

## What is stored on `training_plan_preset`

Prod `training_plan_preset` holds:

| Area | Columns |
|------|---------|
| Identity and copy | `id`, `slug`, `title`, `description`, `publicDescription`, `targetDistanceLabel` |
| Staff / catalog metadata (not read by generate today) | `personaId`, `goalId`, `coachIntent`, `objectiveOfPlan`, `athletePersonaCapability`, `athletePersonaGoal`, `athletePersonaDedication` |
| Mile band | `minWeeklyMiles`, `maxWeeklyMiles` |
| Default weekdays (fallback only) | `tempoIdealDow`, `intervalIdealDow`, `longRunDefaultDow` |
| Phase pointers | `buildPresetId`, `taperPresetId`, `raceWeekPresetId` |
| Sync | `lastSyncedByStaffId`, `createdAt`, `updatedAt` |

**Dropped from this row** (single source of truth elsewhere): pool columns, snap columns, preset-level rotation FKs, `coachPlanOverview`, `workoutStructure`, `easyRunConfig`, `presetPhaseGenerateJson`, `longRunCycleWeeks`.

Staff list/detail APIs may still **return** snap and pool numbers; those are computed in `lib/training/preset-staff-serialize.ts` from the linked `build_preset` and `taper_preset`, not persisted on the preset row.

**Telegraph / product intent** (not all enforced in generate today):

- `targetDistanceLabel` — which race distance this template is for (e.g. Marathon vs 5K); used for picker matching, not race-day distance at generate (that comes from `athlete_races`).
- `goalId` and duplicated persona enums on the preset row are legacy catalog metadata; athlete goal belongs on the plan / `athlete_races`, not on the preset (future rip-out).
- Weekdays athletes care about live on `training_plans` (`preferredDays`, `preferredLongRunDow`, `preferredTempoDow`, `preferredIntervalDow`). Preset ideal DOWs are used only when the plan does not set a preferred tempo/interval day (`assign-workout-days.ts`).

## What is stamped, and where

```
training_plan_preset
  ├── buildPresetId  → build_preset (start/peak LR, rotations)
  ├── taperPresetId  → taper_preset (week caps, slots)
  └── raceWeekPresetId → race_week_preset (race week slots)

build_preset
  └── longRunConfigId, easyConfigId, tempoConfigId, intervalsConfigId → rotation configs → catalogue positions
```

- **Build** (`build_preset`): `startLongRunMiles`, `peakLongRunMiles`, `longRunCutback`, `maxWeeklyMiles`, plus the four rotation config FKs. Quality = tempo + intervals rotations on the build.
- **Taper** (`taper_preset`): `week1*` / `week2*` totals and long-run miles, `weekPins`, `slots`.
- **Race week** (`race_week_preset`): `slots`.
- **Prodpush** (`lib/training/preset-prodpush-upsert.ts`): upserts kept preset scalars and phase rows; ignores dropped JSON/pool fields in the payload.
- **Plan row**: stores `presetId`, athlete baseline (`currentWeeklyMileage`, `weeklyMileageTarget`), goal race (`athleteRaceId` → `athlete_races`), preferred days, and after generate the schedule JSON and snapshots. 5K pace lives on `Athlete.fiveKPace`. Generate does not re-copy the whole preset onto the plan.

## How plan generate reads it

Entry: `lib/training/execute-plan-generate.ts`

1. `loadPlanBlueprintForGenerate` (`lib/training/resolve-plan-blueprint.ts`) — catalog path loads preset scalars + `loadPresetForGenerateFromProd` (`lib/training/load-preset-for-generate-prod.ts`).
2. Requires `buildPresetId` and a populated `build` graph; otherwise catalog generate fails.

| Generate decision | Source |
|-----------------|--------|
| Catalogue workout per long / easy / tempo / interval day | Build rotation positions (`build_preset` configs) |
| Long-run miles through the build | `build.startLongRunMiles`, `peakLongRunMiles`, `longRunCutback` via `applyBuildPhaseLongRunMiles` |
| Taper week miles and pinned workouts | `taper_preset` weeks / slots |
| Race-week days | `race_week_preset.slots` |
| Weekly mileage curve floor and peak | Preset `minWeeklyMiles` / `maxWeeklyMiles`, clamped with athlete start (`weeklyMileageTarget` / plan `currentWeeklyMileage`) in `buildWeeklyMileageTargetsByWeek` |
| Which calendar weekdays get tempo / intervals / long run | **Plan** preferred DOWs; preset `tempoIdealDow` / `intervalIdealDow` / `longRunDefaultDow` only as fallback |
| How many tempo / interval sessions per week | Catalog path: `coachPlanOverview` is null → default 1 tempo + 1 interval (`assign-workout-days.ts`) |
| Easy-day mile cap and pace offset JSON | Catalog path: `easyRunConfig` null → catalogue / distribute-easy defaults |
| Race distance and race week calendar | `athlete_races` on the plan, not `targetDistanceLabel` |
| Workout paces at materialization | Athlete `fiveKPace` + catalogue offsets + athlete `paceAdjuster*` columns (not preset; see `lib/training/athlete-pace-adjuster.ts`) |

Long-run **pool** columns are not stored on the preset row. `resolvedBlueprintFromTrainingManage` (`lib/training/training-manage-blueprint.ts`) still derives nominal pool triplets from `peakLongRunMiles * 4` for legacy cup-setter paths when phase build is absent; when `phaseBuild` is present, build-phase long runs use start/peak on `build_preset`, not stored pools.

## Key files

| Concern | File |
|---------|------|
| Preset loader for generate | `lib/training/load-preset-for-generate-prod.ts` |
| Blueprint merge | `lib/training/resolve-plan-blueprint.ts`, `lib/training/training-manage-blueprint.ts` |
| Generate orchestrator | `lib/training/execute-plan-generate.ts` |
| Day placement | `lib/training/assign-workout-days.ts` |
| Staff serialize (derived snaps/pools) | `lib/training/preset-staff-serialize.ts` |
| Build rotations on preset | `lib/training/catalog-preset-rotation.ts` |
