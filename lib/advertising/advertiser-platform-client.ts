import type { ServedCampaignCreative } from "@/lib/advertising-inventory-types";

function resolveAdvertiserAppUrl(): string | null {
  return (
    process.env.GOFAST_ADVERTISER_APP_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_ADVERTISER_APP_URL?.replace(/\/$/, "") ??
    null
  );
}

function internalHeaders(): HeadersInit {
  const key = process.env.GOFAST_INTERNAL_API_KEY?.trim();
  return {
    Accept: "application/json",
    ...(key ? { "x-gofast-internal-key": key } : {}),
  };
}

export async function fetchServedCampaignForSurface(input: {
  surfaceType: "PROFILE_CONTAINER" | "CLUB_PAGE";
  destinationKey: string;
}): Promise<ServedCampaignCreative | null> {
  const base = resolveAdvertiserAppUrl();
  if (!base) return null;

  const params = new URLSearchParams({
    surfaceType: input.surfaceType,
    destinationKey: input.destinationKey,
  });

  try {
    const response = await fetch(`${base}/api/campaigns/serve?${params.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      success?: boolean;
      primary?: ServedCampaignCreative | null;
    };
    return payload.primary ?? null;
  } catch (error) {
    console.warn("[advertiser-platform-client] serve failed", error);
    return null;
  }
}

export type SurfaceOwnerEarnings = {
  ownerAthleteId: string;
  revenueSharePercent: number;
  totalQualifiedImpressions: number;
  totalEstimatedEarningsCents: number;
  daily: Array<{
    date: string;
    qualifiedImpressions: number;
    estimatedEarningsCents: number;
  }>;
};

export async function fetchSurfaceOwnerEarnings(
  ownerAthleteId: string,
  days = 30
): Promise<SurfaceOwnerEarnings | null> {
  const base = resolveAdvertiserAppUrl();
  if (!base) return null;

  try {
    const response = await fetch(
      `${base}/api/earnings/surface-owner/${encodeURIComponent(ownerAthleteId)}?days=${days}`,
      { headers: internalHeaders(), cache: "no-store" }
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      success?: boolean;
      earnings?: SurfaceOwnerEarnings;
    };
    return payload.earnings ?? null;
  } catch (error) {
    console.warn("[advertiser-platform-client] earnings failed", error);
    return null;
  }
}

export function getAdvertiserImpressionsRegisterUrl(): string | null {
  const base = resolveAdvertiserAppUrl();
  return base ? `${base}/api/impressions/register` : null;
}
