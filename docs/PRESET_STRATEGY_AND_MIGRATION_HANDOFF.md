# Agent handoff: Preset strategy + migration drift fix

Session summary for the next agent. Covers work on **gofastapp-mvp** (schema, APIs, materialization) and **GoFastCompany** (AI wizard, forms, catalogue authoring).

Do not edit the plan files in `.cursor/plans/` — they are reference only.

---

## 1. Core architecture decision (Preset Strategy End Target)

**Problem:** Three layers were mixed:

| Layer | Was doing too much |
|-------|-------------------|
| `training_plan_preset` | Plan strategy + volume + configs |
| `workout_catalogue` | Structure **and** numeric pace offsets |
| `easyRunConfig` on preset | Easy-day behavior **and** easy pace offset (collides with Easy catalogue rows) |

**End target:**

- **Catalogue** = workout structure + segment order + **`paceKey`** names (not persona-specific offsets).
- **Preset** = **`paceProfile`** (named keys → anchor + offset) + persona/strategy fields.
- **Materialization** = `paceKey` + preset `paceProfile` + athlete/goal anchor → actual pace.

Canonical pace keys (MVP1): `relaxed`, `easy`, `steady`, `moderate`, `threshold`, `fiveKPace`, `tenKPace`, `marathonPace`, `recoveryJog`.

Legacy catalogue offset fields (`workPaceOffsetSecPerMile`, `segmentPaceDist[].paceOffsetSecPerMile`, etc.) remain **nullable fallbacks** for coach overrides and old rows.

---

## 2. Schema changes (gofastapp-mvp)

Added to `training_plan_preset` in `prisma/schema.prisma`:

- `coachIntent`, `objectiveOfPlan`
- `athletePersonaCapability` (enum: `NON_RUNNER` | `BEGINNER` | `RECREATIONAL` | `COMPETITIVE` | `ELITE`)
- `athletePersonaGoal`
- `athletePersonaDedication` (enum: `LOW` | `MODERATE` | `HIGH` | `ELITE`)
- `coachPlanOverview` (JSON — volume, composition, structure families)
- `paceProfile` (JSON — named keys with `anchor` + `offsetSecPerMile`)

**Migration:** `prisma/migrations/20260623200000_preset_strategy_fields/migration.sql`

---

## 3. MVP backend (gofastapp-mvp)

| File | Role |
|------|------|
| `lib/training/preset-strategy.ts` | Types, parsers, `parsePresetStrategyFromBody`, default pace profiles |
| `lib/training/pace-key-resolver.ts` | `resolveCataloguePaceSecPerMile` — paceKey → profile → anchor |
| `lib/training/prescription.ts` | Materialization uses resolver; legacy offsets fallback |
| `lib/training/workout-materializer.ts` | Loads preset `paceProfile` from plan → `prescribe()` |
| `app/api/training/plan-preset/route.ts` | POST accepts strategy fields |
| `app/api/training/plan-preset/[id]/route.ts` | PATCH accepts strategy fields |
| `app/api/training/workout/[id]/route.ts` | Lazy segment build passes `paceProfile`; skips `easyRunConfig` override when profile exists |
| `lib/training/catalogue-row.ts` | Documents `paceKey` in segment JSON |
| `lib/training/prescription.test.ts` | Test for LongRun + paceKey + paceProfile |

**Easy pace rule:** When preset has `paceProfile`, materialization prefers catalogue + profile over `easyRunConfig.paceOffsetSecPerMile`.

---

## 4. GoFastCompany (staff UI + AI wizard)

| File | Role |
|------|------|
| `lib/training/preset-strategy.ts` | Shared types + persona options + default profiles |
| `lib/training/preset-form-model.ts` | Form state + submit payload includes strategy fields |
| `lib/training/preset-recommendation-types.ts` | Intent input uses `athletePersonaCapability` (not `audience`) |
| `lib/training/plan-preset-coach-agent.ts` | AI outputs `strategy`, `coachPlanOverview`, `paceProfile` |
| `lib/training/preset-recommendation-validate.ts` | Validates AI output → `strategy` + draft |
| `app/dashboard/training-engine/plan-config/PresetWizard.tsx` | **Sidebar wizard** (not pill tabs): Intent → Plan identity → Persona → Overview → Volume → Composition → Pace profile → Run-type configs → Catalogue gaps → Review |
| `lib/training/pace-key-catalogue.ts` | Segment payload builders prefer `paceKey` over raw offset |
| `app/dashboard/training-engine/catalogue/CatalogueEditForm.tsx` | Long-run segments: pace key dropdown + legacy offset fallback |
| `lib/training/catalogue-development-service.ts` | AI catalogue proposals prefer paceKeys |

Company proxies plan-preset APIs via `lib/server/training-product-proxy.ts` — no extra fields needed on proxy routes; body passes through.

**Preset creation entry:** `/dashboard/training-engine/plan-config/new` → Manual vs **Preset with AI** (`/new/ai`).

---

## 5. Migration drift fix (fatal `migrate dev` issue)

### What went wrong

- Legacy migration `20241214220000_add_planning_days_to_weeks` lives only in **`prisma/migrations_legacy_prebaseline_20260622/`** (archive).
- It alters `training_plan_weeks`, which **no longer exists**.
- DB row in `_prisma_migrations` was **failed then rolled back** (`applied_steps_count = 0`).
- Running `prisma migrate dev` on shared Neon could prompt **reset** (data loss). **`migrate deploy`** against active `prisma/migrations/` is safe.

### What we added

| Item | Purpose |
|------|---------|
| `scripts/migration-health.mjs` | Fails only on **unresolved** failed migrations; ignores safely rolled-back legacy row |
| `scripts/with-env-local.mjs` | Loads `.env` + `.env.local` for Prisma CLI |
| `docs/MIGRATION_WORKFLOW.md` | Active vs archive folders, safe commands, when not to use `migrate dev` |
| `prisma/migrations_legacy_prebaseline_20260622/README.md` | Archive-only warning |
| `docs/MIGRATION_MANUAL_STEPS.md` | Updated to point at safe workflow (removed stale “failed migration” note) |

### Safe npm scripts (`gofastapp-mvp/package.json`)

```bash
npm run prisma:health   # check _prisma_migrations
npm run prisma:status   # migrate status
npm run prisma:migrate  # migrate deploy (CI/build safe)
```

**Do not:** `migrate reset` on shared DBs, or `migrate resolve --applied` for the legacy planning_days migration.

**Active migrations only:** `prisma/migrations/` (baseline + incremental). Archive folder is reference-only.

---

## 6. How to run migrations (operator)

From `gofastapp-mvp`:

```bash
npm run prisma:health
npm run prisma:status
npm run prisma:migrate
```

Requires `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in `.env.local`.

At handoff time, dev DB reported **up to date** with all migrations in `prisma/migrations/` applied. The repo may have gained additional migrations since — always run `prisma:status` first.

---

## 7. Known limitations / follow-ups

1. **Generator composition:** `assign-workout-days.ts` still has `HARD_SESSION_SLOTS = 2` — cannot honor `tempo: 0` / `intervals: 0` in `coachPlanOverview.weeklyWorkoutComposition` without a follow-up pass. Wizard shows a warning when intent recommends zero tempo/intervals.

2. **Catalogue migration:** Most existing catalogue rows still use numeric offsets; new/AI rows should use `paceKey`. No bulk data migration was run on seed catalogue rows.

3. **PresetForm (manual path):** Strategy fields flow through `preset-form-model` and API; manual create/edit UI may not expose all strategy fields visually — AI wizard is the primary path for persona + pace profile.

4. **Phase 3 (Catalogue Selection Service):** Separate agent/service after intent — select rotation configs / propose catalogue gaps; do not resolve paces there.

---

## 8. Quick test checklist

- [ ] `npm run prisma:health` → OK
- [ ] Create preset via AI wizard at `/dashboard/training-engine/plan-config/new/ai`
- [ ] Confirm POST `/api/training/plan-preset` persists `coachIntent`, `paceProfile`, persona enums
- [ ] Materialize an Easy/LongRun workout on a plan linked to that preset — paces resolve via profile when segments use `paceKey`
- [ ] `node --import tsx --test lib/training/prescription.test.ts` in gofastapp-mvp

---

## 9. Related plan files (read-only)

- `.cursor/plans/preset_strategy_target_6c531739.plan.md` — full preset strategy phases
- `.cursor/plans/migration_drift_fix_bb7862ad.plan.md` — migration drift remediation

---

*Last updated from agent session: preset strategy implementation + migration drift fix + successful `prisma:migrate` on dev.*
