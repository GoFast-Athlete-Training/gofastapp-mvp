-- Legacy relational plan structure (unused by gofastapp-mvp; canonical data is training_plans.planWeeks JSON + workouts).
DROP TABLE IF EXISTS "training_plan_weeks" CASCADE;
DROP TABLE IF EXISTS "training_plan_phases" CASCADE;
