import { prisma } from "@/lib/prisma";
import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";

export async function loadPresetPhaseForGenerateFromProd(
  presetId: string,
): Promise<TrainingManagePresetForGenerate | null> {
  const row = await prisma.training_plan_preset.findUnique({
    where: { id: presetId },
    select: { presetPhaseGenerateJson: true },
  });
  if (!row?.presetPhaseGenerateJson || typeof row.presetPhaseGenerateJson !== "object") {
    return null;
  }
  const phase = row.presetPhaseGenerateJson as TrainingManagePresetForGenerate;
  if (phase.id !== presetId) return null;
  return phase;
}
