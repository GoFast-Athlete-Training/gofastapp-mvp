-- Drop RunTogether / LevelUp tables that were accidentally included in the MVP baseline
-- migration but are not declared in prisma/schema.prisma.
--
-- Preflight (2026-06-24): only levelup_url_roles had rows (2); all other orphan tables were empty.
-- MVP-owned tables (coaches, workouts, run_clubs, etc.) are intentionally preserved.

-- Drop child tables first (FK order), then parents. CASCADE handles any remaining dependencies.

DROP TABLE IF EXISTS "levelup_workout_segments" CASCADE;
DROP TABLE IF EXISTS "levelup_workouts" CASCADE;
DROP TABLE IF EXISTS "levelup_url_roles" CASCADE;

DROP TABLE IF EXISTS "run_program_memberships" CASCADE;
DROP TABLE IF EXISTS "run_program_sessions" CASCADE;
DROP TABLE IF EXISTS "season_clubs" CASCADE;
DROP TABLE IF EXISTS "run_program_satellites" CASCADE;
DROP TABLE IF EXISTS "run_programs" CASCADE;

DROP TABLE IF EXISTS "program_owner_coach_links" CASCADE;
DROP TABLE IF EXISTS "program_companies" CASCADE;
DROP TABLE IF EXISTS "program_owners" CASCADE;

DROP TABLE IF EXISTS "player_assessments" CASCADE;
DROP TABLE IF EXISTS "young_athletes" CASCADE;
DROP TABLE IF EXISTS "run_parents" CASCADE;

DROP TABLE IF EXISTS "team_memberships" CASCADE;
DROP TABLE IF EXISTS "team_seasons" CASCADE;
DROP TABLE IF EXISTS "teams" CASCADE;

DROP TABLE IF EXISTS "practice_block_activities" CASCADE;
DROP TABLE IF EXISTS "practice_blocks" CASCADE;
DROP TABLE IF EXISTS "practices" CASCADE;
DROP TABLE IF EXISTS "sport_activities" CASCADE;

DROP TABLE IF EXISTS "coach_event_volunteer_signups" CASCADE;
DROP TABLE IF EXISTS "coach_event_volunteer_jobs" CASCADE;
DROP TABLE IF EXISTS "coach_events" CASCADE;

DROP TABLE IF EXISTS "navigation" CASCADE;

-- RunTogether youth coach table (singular). MVP uses "coaches" (plural).
DROP TABLE IF EXISTS "coach" CASCADE;
