import { prisma } from "@/lib/prisma";

export type CatalogPresetApiSummary = {
  id: string;
  title: string;
  slug?: string;
  publicDescription: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  targetDistanceLabel?: string | null;
};

function summaryFromRow(row: {
  id: string;
  title: string;
  slug: string;
  publicDescription: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  targetDistanceLabel: string | null;
}): CatalogPresetApiSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    publicDescription: row.publicDescription,
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    targetDistanceLabel: row.targetDistanceLabel,
  };
}

const presetSummarySelect = {
  id: true,
  title: true,
  slug: true,
  publicDescription: true,
  minWeeklyMiles: true,
  maxWeeklyMiles: true,
  targetDistanceLabel: true,
} as const;

export async function catalogPresetSummaryForApi(
  presetId: string,
  _authorization?: string | null,
): Promise<CatalogPresetApiSummary | null> {
  const row = await prisma.training_plan_preset.findUnique({
    where: { id: presetId },
    select: presetSummarySelect,
  });
  return row ? summaryFromRow(row) : null;
}

export async function catalogPresetExistsInTrainingManage(
  presetId: string,
  _authorization?: string | null,
): Promise<boolean> {
  const row = await prisma.training_plan_preset.findUnique({
    where: { id: presetId },
    select: { id: true },
  });
  return row != null;
}

/** @deprecated use catalogPresetExistsInTrainingManage — name kept for call sites */
export const catalogPresetExistsOnProd = catalogPresetExistsInTrainingManage;
