import type { CatalogueRecommendRow } from "@/lib/training/recommend-quality-catalogue";

export type QualityCatalogueItem = CatalogueRecommendRow & {
  ownerAthleteId?: string | null;
  workoutType?: string | null;
  warmupMiles?: number | null;
  warmupPaceOffsetSecPerMile?: number | null;
  cooldownMiles?: number | null;
  cooldownPaceOffsetSecPerMile?: number | null;
  workBaseMiles?: number | null;
  workPaceOffsetSecPerMile?: number | null;
  workBasePaceOffsetSecPerMile?: number | null;
  recoveryDistanceMeters?: number | null;
  recoveryDurationSeconds?: number | null;
};
