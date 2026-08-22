import { prisma } from "@/lib/prisma";

export type EnsurePlanPresetOutcome =
  | { ok: true; kind: "catalog" | "athlete"; presetId: string | null; athletePresetId: string | null }
  | { ok: false; kind: "plan_not_found" | "preset_not_assigned" };

/**
 * Plan must link to a staff catalog preset and/or an athlete-owned blueprint before generate.
 */
export async function ensureTrainingPlanPresetLinked(params: {
  planId: string;
  athleteId: string;
}): Promise<EnsurePlanPresetOutcome> {
  const plan = await prisma.training_plans.findFirst({
    where: { id: params.planId, athleteId: params.athleteId },
    select: { presetId: true, athletePresetId: true },
  });
  if (!plan) return { ok: false, kind: "plan_not_found" };
  if (!plan.presetId && !plan.athletePresetId) {
    return { ok: false, kind: "preset_not_assigned" };
  }
  return {
    ok: true,
    kind: plan.athletePresetId ? "athlete" : "catalog",
    presetId: plan.presetId,
    athletePresetId: plan.athletePresetId,
  };
}
