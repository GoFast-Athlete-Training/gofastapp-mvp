# Workout UX → Our Model → Garmin (Cut Through the Fog)

## Garmin’s two concepts per step

Every Garmin step has:

1. **Duration** = *how long / how far* (TIME in seconds, or DISTANCE in meters). “Miles” is duration, not target.
2. **Target** = *what to aim for* while doing that duration:
   - **PACE** → band in sec/km (valueLow, valueHigh)
   - **HEART_RATE** → band in bpm (valueLow, valueHigh)
   - **OPEN** → no target (just run the duration)

So: **miles = duration**. **Pace or HR = target.** We build one “target” per step (or two: primary + secondary, e.g. pace + HR).

---

## UX field → our model → Garmin

| UX (Create page) | Where it goes in our model | What Garmin sees |
|------------------|----------------------------|-------------------|
| **Workout Type** (LongRun, Tempo, …) | `workouts.workoutType` | **Sport** only: we map type → `GarminSport.RUNNING`. Garmin does **not** get “LongRun” per step. |
| **Total Miles** | Not stored as one number. Used to **split** into segment durations. | Each segment’s `durationValue` (miles) → we send **meters** per step. So total miles = sum of segment miles → becomes many step durations in meters. |
| **Goal Pace** "7:30/mile" | **Never stored as string.** We convert to sec/km and put in **each segment’s `targets`**: `[{ type: "PACE", valueLow: X, valueHigh: Y }]`. | Each step’s **target**: `targetType: PACE`, `targetValueLow`/`targetValueHigh` (sec/km). So the string is gone; only the numbers in `targets` flow to Garmin. |
| **Race Time + Distance** | Same as Goal Pace: we derive goal pace (sec/mi) → training paces → per-segment **targets** (PACE). | Same as above: PACE target per step. |
| **Optional: describe anything specific** | Sent to AI as `freeformPrompt`. Only influences **generated** segments; not stored as its own field. | Only affects what segments (and thus targets) we create. |
| **Paste from Runna/coach** | Parsed by AI into **segments** (title, durationValue, targets). Stored like any other segments. | Same as below: each segment → one step (duration + target). |
| **Per-segment: Title** (Warmup, Main Set, …) | `workout_segments.title` | **Intensity** is **inferred from this string** in code: "warmup" → WARMUP, "cooldown" → COOLDOWN, "recovery"/"rest" → INTERVAL_REST, "interval"/"repeat" → INTERVAL_TARGET, else ACTIVE. So Garmin’s “intensity” comes from our title, not from an enum. |
| **Per-segment: Miles** | `workout_segments.durationValue` (with `durationType: "DISTANCE"`) | Step **duration** in **meters** (we convert miles → meters). |
| **Per-segment: Pace** (e.g. "8:00/mile") | Converted to sec/km and stored in **`workout_segments.targets`**: `[{ type: "PACE", valueLow, valueHigh }]`. | Step **target**: `targetType: PACE`, `targetValueLow`/`targetValueHigh` (sec/km). |
| **Per-segment: HR Min/Max** | Stored in **`workout_segments.targets`**: second entry `{ type: "HEART_RATE", valueLow, valueHigh }`. | Step **secondary target** (or primary if no pace): `targetType: HEART_RATE`, `targetValueLow`/`targetValueHigh`. |
| **Per-segment: Repeat** (e.g. 6x) | `workout_segments.repeatCount` | We emit a **REPEAT** step (repeatValue = 6) then the STEP. So “6x800m” = one REPEAT + one STEP (800m). |

So: **target** in our system = **target** in Garmin. We build it from **pace** (string → sec/km in `targets`) and/or **HR** (numbers in `targets`). **Miles** is always **duration**, not target.

---

## Where the fog is (and why it feels brittle)

1. **Pace is a string in the UX but not in the DB**  
   We parse "7:30/mile" → sec/km and put only numbers in `targets`. So “where does pace map to?” → it maps to **segment.targets** with `type: "PACE"`. The string is the input; the stored and Garmin-facing shape is numeric (sec/km). The form sometimes shows pace again by **reconstructing** it from `targets` (sec/km → "M:SS/mile") for display. So: **UX string ↔ targets[].PACE (sec/km) ↔ Garmin targetType PACE.**

2. **Workout Type doesn’t drive Garmin step intensity**  
   We store workout type and use it for sport and for our templates. But **per-step intensity** (WARMUP, ACTIVE, COOLDOWN, etc.) comes from **segment.title**. So “LongRun” in the dropdown doesn’t set Garmin intensity; the **segment titles** (Warmup, Long Run, Cooldown) do, via string matching. That’s the brittle part: no explicit stage enum.

3. **Two ways to set “pace”**  
   - **AI Generate**: Goal Pace (or race time) → we derive zones (easy, tempo, …) → each segment gets a PACE target in `targets`.  
   - **Manual segments**: User types pace per segment → we convert to sec/km and put in `targets`.  
   So “target” is how we build it: **pace (and HR) become the `targets` array; that’s what Garmin gets as target.**

4. **Miles is always duration**  
   Total miles = sum of segment durations. Each segment’s miles → one step’s **duration** (in meters). So: **miles = duration**. **Pace or HR = target.** Not interchangeable.

5. **“Optional: describe” and paste**  
   They only influence **which segments we create** (and thus which durations and targets). They don’t get a dedicated column; the result is just more segments with title/duration/targets.

---

## One-line summary

- **Target** = how we build “what to aim for”: **pace** (string in UX → sec/km in `targets`) and/or **HR** (numbers in `targets`). Garmin’s `targetType` / `targetValueLow`/`High` = our `targets[]`.
- **Miles** = **duration** (how far), not target. We send it as meters per step.
- **Intensity** (warmup, cooldown, etc.) = from **segment.title** today (string match), not from workout type or an enum — that’s the main brittleness.
- So: **type** (workout type) is clear; **pace** maps to **segment.targets** (PACE, sec/km); **miles** maps to **segment.durationValue** (then to meters). Getting through the fog means making that mapping explicit in the UX (e.g. “Pace target” / “HR target” per block, and optional “Stage” so we don’t infer from title).
