# Plan: Race Intent + Blob Parse + Segment Flows (MVP1-ish)

Single reference for: **race goal intent** (no 20-week plan lock-in), **blob parse** (type + paste → segments), **segment model** (type vs derived title), and **forked workout page** (two choices).

---

## 1. Race goal intent (no full plan)

**Why:** Full 20-week plan = phases, weeks, storing days — collision we hit. **Intent** = light: "my goal race + goal time." Build workouts from intent; full plan later optional.

**Schema:** New model `race_goal_intent` (one per athlete):
- `athleteId`, `raceId` (FK race_registry), `goalTime`, `goalPace5K?`, timestamps.
- When we add "build my 20-week plan," we snapshot intent into `training_plans`; intent stays independent.

**API:** GET/PUT `/api/athlete/[id]/race-goal-intent`. Upsert one row per athlete.

**UI:** Minimal — set goal race (search race_registry) + goal time; save to intent. No plan, no days.

**Workout generator:** Resolve goal pace from `race_goal_intent` (goalTime + race distance) or fallback `Athlete.fiveKPace`. Build **one workout** at a time; no plan, no storing days.

---

## 2. Blob parse (MVP1 parser)

**Flow:** Only input before the blob is **workout type**. Then one paste area: "Paste from Runna, coach, or Strava." Single **Derive workout** button.

**API:** `POST /api/workouts/ai-generate` with `workoutType` + `sourceText` (blob). No required totalMiles/goalPace for this path.

**AI:** Parser only. Prompt: given workout type + pasted description, extract segments — each with segment type (Warmup | Rest | Interval | Cooldown), durationType, durationValue, pace range (valueLow/valueHigh sec/km) if present, repeatCount. Output our segment JSON. Optionally suggest workout title.

**Result:** Segments (and suggested title/description) populate the form; user edits if needed and saves. Total miles = derived from segments (display only).

---

## 3. Segments: type vs derived title

**Stored:** Segment **type** (Warmup, Rest, Interval, Cooldown) — what kind of step. Today we use `workout_segments.title` for this; we can keep it as type or rename conceptually.

**Derived:** Display **title** from type + duration + target, e.g. "1 mile warmup", "9 × 0.5 mi @ 6:05–6:35", "1 mile cooldown." So we don’t store a freeform title; we derive it for the UI. (Optional: add explicit `segmentType` enum later; for now title-as-type is fine.)

**Blob parse:** AI returns segment type + duration + targets; we store that. Display strings are derived when rendering.

---

## 4. Forked workout create page

**Step 1 (universal):** Pick **workout type** (Easy, Tempo, LongRun, Intervals). Single source of truth.

**Step 2 — Two choices:**
- **Add from coach / Runna / Strava** — Show paste area + "Derive workout." Calls ai-generate with `workoutType` + `sourceText`. Populates segments (and name/description). No intent required.
- **Get a workout from GoFast** — "Generate for me." Calls workout-from-intent API. Reads `race_goal_intent` (or Athlete.fiveKPace); derives paces; picks total miles (e.g. 5–7); returns one workout (segments). If no intent/5k, direct user to set race intent or 5k pace in profile.

**After either path:** Same segment list; user can edit; save writes workout + segments. No "Overall" vs "Segments" toggle; workout is always segment-based after derive/generate.

---

## 5. Summary table

| Piece | What |
|-------|------|
| **Race intent** | New `race_goal_intent`; GET/PUT API; minimal UI (goal race + goal time). No plan, no days. |
| **Build you a workout** | Generator reads intent (or 5k); returns one workout. No 20-week plan. |
| **Blob parse** | Type + paste → ai-generate (parser only) → segments. |
| **Segments** | Type stored; display title derived (e.g. "1 mile warmup"). |
| **Create page** | Type first → two choices (paste vs Get from GoFast) → segments → save. |

---

## 6. Out of scope for this plan

- Full 20-week plan generation (phases, weeks, planned days). When we add it, it snapshots from intent.
- Storing planned days / training_days_planned. That stays in the future plan feature.
- Segment type as a separate enum column (optional later); for now title-as-type is fine.

This gets us to: **intent** for personalization, **blob parse** for coach/Runna input, **segments** as the single structure, and **one create flow** with two clear entry paths.
