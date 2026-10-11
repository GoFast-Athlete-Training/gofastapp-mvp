import { fetchTrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";
import { fetchTrainingManageTemplatePreset } from "@/lib/training/fetch-training-manage-catalog";

export type CatalogPresetApiSummary = {
  id: string;
  title: string;
  slug?: string;
  publicDescription: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  targetDistanceLabel?: string | null;
};

export async function catalogPresetSummaryForApi(
  presetId: string,
): Promise<CatalogPresetApiSummary | null> {
  const tm = await fetchTrainingManagePresetForGenerate(presetId);
  if (tm) {
    return {
      id: tm.id,
      title: tm.title,
      slug: tm.slug,
      publicDescription: tm.publicDescription,
      minWeeklyMiles: tm.minWeeklyMiles,
      maxWeeklyMiles: tm.maxWeeklyMiles,
      targetDistanceLabel: tm.targetDistanceLabel,
    };
  }
  const template = await fetchTrainingManageTemplatePreset(presetId);
  if (!template) return null;
  return {
    id: template.id,
    title: template.title,
    slug: template.slug,
    publicDescription: null,
    minWeeklyMiles: 40,
    maxWeeklyMiles: null,
    targetDistanceLabel: template.targetDistanceLabel,
  };
}

export async function catalogPresetExistsInTrainingManage(presetId: string): Promise<boolean> {
  const row = await fetchTrainingManageTemplatePreset(presetId);
  return row != null;
}
