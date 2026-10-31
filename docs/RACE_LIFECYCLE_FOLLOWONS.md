# Race lifecycle — follow-on designs

Implemented lifecycle horizons and source validation are documented in Race Manage `docs/RACE_LIFECYCLE.md`.

## Cohort plan start

Prod `training_cohorts.defaultPlanStartDate` should open at the **training-cycle** boundary for the linked `race_registry` row. Individual claim → goal → `/training-setup` remains the default path.

## Shakeout activation

Ops deadline: complete shakeout authoring and source checks before the **race-week** horizon. Detailed RSVP, club association, and check workflow is a separate design pass on prod `city_runs` (`RACE_SHAKEOUT`).
