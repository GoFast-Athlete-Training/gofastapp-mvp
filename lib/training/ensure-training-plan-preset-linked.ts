import { prisma } from "@/lib/prisma";

/** Oldest seeded preset wins (Coach / migration order). */
const defaultPresetOrder = { createdAt: "asc" as const };

export type EnsurePlanPresetOutcome =
  | { ok: true; presetId: string }
  | { ok: false; kind: "plan_not_found" | "no_system_preset" };

/**
 * Guarantee `training_plans.presetId` is populated before generator runs:
 * heals legacy rows and matches POST `/api/training-plan` default resolution.
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
  if (plan.presetId) return { ok: true, presetId: plan.presetId };

  const preset = await prisma.training_plan_preset.findFirst({
    orderBy: defaultPresetOrder,
    select: { id: true },
  });
  if (!preset) return { ok: false, kind: "no_system_preset" };

  await prisma.training_plans.update({
    where: { id: params.planId },
    data: { presetId: preset.id, updatedAt: new Date() },
  });
  return { ok: true, presetId: preset.id };
}
