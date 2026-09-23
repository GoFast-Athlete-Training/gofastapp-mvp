# Preset miles canon

Staff and athletes confirm **five numbers** on a preset. Weekly min/max bands and persona essays are not the product surface.

## Preset core

| Label | Meaning | Storage (this pass) |
| --- | --- | --- |
| Long-run peak | One long run you build to (e.g. 21 mi) | `coachPlanOverview.longRunStructure.peakLongRunMiles` |
| Weekly volume peak | Peak week total mileage | `maxWeeklyMiles` |
| Weekly average | Typical week — calculated from volume peak | Derived (~88% of peak; formula TBD) |
| Total runs per week | Run days per week | `coachPlanOverview.weeklyWorkoutComposition` sum |
| Total quality sessions | Tempo + intervals only | Same composition; long run excluded |

## Not preset core

- **`peakLongRunPoolMiles` (the ~70)** — legacy sum of a 4-Saturday block. Plan generate’s old path splits it by `distributionWeight`. That is not the long-run peak.
- **`minWeeklyMiles`** — floor / legacy; not the athlete confirm dimension.
- **Persona fields** — snap to the five numbers; they do not gate editing.

## Quality sessions

Elite expectation: **2** quality sessions (tempo + intervals). A marathon-pace long run is still the **long run**, not a third quality day.

## Long-run builder

New plans should use the long-run builder: rotation slot miles (from catalogue `workBaseMiles` when set) stepping up to **long-run peak**, optional cutback, then taper. If there are not enough Saturdays before taper, skip the cutback.

## Plan generate

Next pass: athlete confirms the five numbers, then generate uses the stub rules in `lib/training/plan-generate-core-stub.ts`. Today’s `execute-plan-generate.ts` still uses flat `weeklyMileageTarget` and pool split — unchanged in this pass.
