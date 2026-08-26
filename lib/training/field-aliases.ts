/** Non-destructive API/UI aliases for preset realignment naming. */

import type { PlanGoalApi } from "@/lib/training/plan-entity-serialize";
import type { TrainingPlanGoalType } from "@/lib/training/preset-realignment-types";

export function goalApiGoalType(goal: PlanGoalApi): TrainingPlanGoalType {
  if (goal.goalType === "RACE" || goal.goalType === "GENERAL_FITNESS" || goal.goalType === "MORE_ENDURANCE") {
    return goal.goalType;
  }
  if (goal.goalKind === "RACE") return "RACE";
  return "GENERAL_FITNESS";
}

export const ROTATION_LABELS = {
  longRunConfigId: "Long run rotation",
  easyConfigId: "Easy run rotation",
  tempoConfigId: "Tempo rotation",
  intervalsConfigId: "Intervals rotation",
} as const;
