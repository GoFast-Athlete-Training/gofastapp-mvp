import { prisma } from "@/lib/prisma";
import { buildGoalSlug, normalizeSlug } from "@/lib/training/plan-entity-slugs";
import { findGoalBySlug } from "@/lib/training/plan-persona-goal";
import { serializePlanGoal, type PlanGoalApi } from "@/lib/training/plan-entity-serialize";
import type { TrainingPlanGoalType } from "@/lib/training/preset-realignment-types";

export type GoalSuggestResult = {
  suggestedSlug: string;
  suggestedLabel: string;
  exactMatch: PlanGoalApi | null;
  similar: PlanGoalApi[];
};

export function buildSuggestedGoalLabel(opts: {
  targetDistanceLabel?: string | null;
  planDurationWeeks?: number | null;
  goalType?: TrainingPlanGoalType | null;
}): string {
  const dist = opts.targetDistanceLabel?.trim() || "General";
  const weeks = opts.planDurationWeeks ?? 12;
  const type =
    opts.goalType === "GENERAL_FITNESS"
      ? "fitness"
      : opts.goalType === "MORE_ENDURANCE"
        ? "endurance"
        : "race";
  return `${dist} · ${weeks}w ${type}`;
}

export async function suggestGoals(opts: {
  personaSlug?: string | null;
  personaId?: string | null;
  targetDistanceLabel?: string | null;
  planDurationWeeks?: number | null;
  goalType?: TrainingPlanGoalType | null;
  suggestedSlug?: string | null;
}): Promise<GoalSuggestResult> {
  const weeks = Math.max(1, Math.round(opts.planDurationWeeks ?? 12));
  const personaSlug = normalizeSlug(opts.personaSlug ?? "");
  const suggestedSlug =
    normalizeSlug(opts.suggestedSlug ?? "") ||
    (personaSlug ? buildGoalSlug(personaSlug, weeks) : "");

  const suggestedLabel = buildSuggestedGoalLabel({
    targetDistanceLabel: opts.targetDistanceLabel,
    planDurationWeeks: weeks,
    goalType: opts.goalType,
  });

  const exactRow = suggestedSlug ? await findGoalBySlug(suggestedSlug) : null;
  const exactMatch = exactRow ? serializePlanGoal(exactRow) : null;

  const similarRows = await prisma.training_plan_goal.findMany({
    where: {
      ...(exactRow ? { id: { not: exactRow.id } } : {}),
      ...(opts.personaId ? { personaId: opts.personaId } : {}),
      ...(opts.targetDistanceLabel
        ? { targetDistanceLabel: opts.targetDistanceLabel }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { persona: true },
  });

  return {
    suggestedSlug,
    suggestedLabel,
    exactMatch,
    similar: similarRows.map(serializePlanGoal),
  };
}
