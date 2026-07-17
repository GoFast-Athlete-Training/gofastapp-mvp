/**
 * Approved-fields contract for public advertising inventory (prod export).
 * Mirror of gf-advertisingplatform/lib/inventory-types.ts — keep in sync.
 */
export type AdvertisingSurfaceType = "CLUB_PAGE" | "PROFILE_CONTAINER";

export type AdvertisingSurfaceDestination = {
  surfaceType: AdvertisingSurfaceType;
  destinationKey: string;
  name: string;
  publicUrl: string;
  ownerAthleteId?: string | null;
  city?: string | null;
  state?: string | null;
  memberCount?: number | null;
  engagementSummary?: string | null;
};

export type ServedCampaignCreative = {
  campaignId: string;
  campaignName: string;
  brandCampaignCollateralUrl: string | null;
  ctaUrl: string | null;
  ctaLabel: string | null;
  destinationSurfaceType: AdvertisingSurfaceType;
  destinationKey: string;
  placementKey: string;
};
