-- Pause replaces park. Existing parked rows become paused.
ALTER TYPE "TrainingPlanLifecycle" RENAME VALUE 'PARKED' TO 'PAUSED';
