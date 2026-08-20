/**
 * Goal service — goals live on athlete_races rows.
 * Re-exports for backward compatibility with existing imports.
 */

export { deriveGoalPaces } from "@/lib/pace-utils";
export {
  normalizeMotivationIcon,
  listAthleteRaceGoals as getActiveGoals,
  getPrimaryGoalForWorkout,
  createRaceGoal as createGoal,
  updateRaceGoal as updateGoal,
  getAthleteRaceGoalById,
  serializeGoalFromAthleteRace,
  getPrimaryAthleteRaceForAthlete,
  type UpsertRaceGoalInput as CreateGoalInput,
  type UpsertRaceGoalInput as UpdateGoalInput,
} from "@/lib/athlete-race-goal";
