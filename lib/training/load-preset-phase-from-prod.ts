import { loadPresetForGenerateFromProd } from "@/lib/training/load-preset-for-generate-prod";
import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";

export async function loadPresetPhaseForGenerateFromProd(
  presetId: string,
): Promise<TrainingManagePresetForGenerate | null> {
  return loadPresetForGenerateFromProd(presetId);
}
