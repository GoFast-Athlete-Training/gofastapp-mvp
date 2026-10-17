# City run ↔ workout FK canon

| Field on `city_runs` | Points at | Owns |
|----------------------|-----------|------|
| `routeId` | `routes` | Path, map, route description |
| `workoutId` | `workouts` | Structured workout (join-my-workout) |
| `plannedWorkoutId` | `planned_workouts` (unique) | Club template or host prescribe row |

**Invite row** holds meetup metadata: `title`, `description`, time, meetup place.

**Pace bands and miles** for product display should come from the linked workout / planned workout, not new strings on the invite. Legacy `city_runs.pace` and `city_runs.totalMiles` remain for older rows until a dedicated cleanup pass.

**Match activity** uses `city_run_activity_links` after the run; it does not replace `plannedWorkoutId`.

**Execution** (`cityRunExecutionStatus`) is separate from `workflowStatus` (editorial) and from the past clock.
