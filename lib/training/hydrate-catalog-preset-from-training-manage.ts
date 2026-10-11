import { fetchTrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";
import {
  fetchTrainingManageCatalogPresets,
  fetchTrainingManageTemplatePreset,
  type TrainingManageCatalogPreset,
} from "@/lib/training/fetch-training-manage-catalog";

export type CatalogPresetApiSummary = {
  id: string;
  title: string;
  slug?: string;
  publicDescription: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  targetDistanceLabel?: string | null;
};

function summaryFromCatalogRow(p: TrainingManageCatalogPreset): CatalogPresetApiSummary {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    publicDescription: p.publicDescription,
    minWeeklyMiles: p.minWeeklyMiles,
    maxWeeklyMiles: p.maxWeeklyMiles,
    targetDistanceLabel: p.targetDistanceLabel,
  };
}

export async function catalogPresetSummaryForApi(
  presetId: string,
  authorization?: string | null,
): Promise<CatalogPresetApiSummary | null> {
  if (authorization?.trim()) {
    const catalog = await fetchTrainingManageCatalogPresets(authorization);
    const hit = catalog?.find((p) => p.id === presetId);
    if (hit) return summaryFromCatalogRow(hit);

    const template = await fetchTrainingManageTemplatePreset(presetId, authorization);
    if (template) {
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
  }

  const tm = await fetchTrainingManagePresetForGenerate(presetId);
  if (!tm) return null;
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

export async function catalogPresetExistsInTrainingManage(
  presetId: string,
  authorization?: string | null,
): Promise<boolean> {
  if (authorization?.trim()) {
    const catalog = await fetchTrainingManageCatalogPresets(authorization);
    if (catalog?.some((p) => p.id === presetId)) return true;
    const template = await fetchTrainingManageTemplatePreset(presetId, authorization);
    if (template) return true;
  }

  const tm = await fetchTrainingManagePresetForGenerate(presetId);
  return tm != null;
}
