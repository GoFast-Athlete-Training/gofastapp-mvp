import { prisma } from "@/lib/prisma";

export type EnsurePlanPresetOutcome =
  | { ok: true; presetId: string }
  | { ok: false; kind: "plan_not_found" | "preset_not_assigned" };

/**
 * Preset linkage is explicit: coaches assign `training_plans.presetId` (Company) or
 * athletes choose a published blueprint at plan creation (`POST /api/training-plan` with presetId).
 * This helper does not invent or persist a default preset.
 */
export async function ensureTrainingPlanPresetLinked(params: {
  planId: string;
  athleteId: string;
}): Promise<EnsurePlanPresetOutcome> {
  const plan = await prisma.training_plans.findFirst({
    where: { id: params.planId, athleteId: params.athleteId },
    select: { presetId: true },
  });
  if (!plan) return { ok: false, kind: "plan_not_found" };
  if (!plan.presetId) return { ok: false, kind: "preset_not_assigned" };
  return { ok: true, presetId: plan.presetId };
}
