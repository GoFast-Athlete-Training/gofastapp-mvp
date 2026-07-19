export type AthleteAdvertisingEarnings = {
  source: "spend" | "impressions";
  revenueSharePercent: number;
  totalEstimatedEarningsCents: number;
  totalAttributedSpendCents?: number;
  totalQualifiedImpressions?: number;
  totalCampaignPurchases?: number;
  daily: Array<{
    date: string;
    estimatedEarningsCents: number;
    qualifiedImpressions?: number;
    campaignPurchases?: number;
    attributedSpendCents?: number;
  }>;
};

function resolveCompanyAppUrl(): string | null {
  return (
    process.env.GOFAST_COMPANY_APP_URL?.replace(/\/$/, "") ??
    process.env.GOFAST_COMPANY_API_URL?.replace(/\/$/, "") ??
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

type CompanySpendEarnings = {
  ownerAthleteId: string;
  revenueSharePercent: number;
  totalAttributedSpendCents: number;
  totalEstimatedEarningsCents: number;
  daily: Array<{
    date: string;
    campaignPurchases: number;
    attributedSpendCents: number;
    estimatedEarningsCents: number;
  }>;
};

export async function fetchAthleteSpendEarningsFromCompany(
  ownerAthleteId: string,
  days = 30
): Promise<AthleteAdvertisingEarnings | null> {
  const base = resolveCompanyAppUrl();
  if (!base) return null;

  try {
    const response = await fetch(
      `${base}/api/advertiser/athlete-earnings/${encodeURIComponent(ownerAthleteId)}?days=${days}`,
      { headers: internalHeaders(), cache: "no-store" }
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      success?: boolean;
      earnings?: CompanySpendEarnings;
    };
    const earnings = payload.earnings;
    if (!earnings) return null;

    const totalCampaignPurchases = earnings.daily.reduce(
      (sum, point) => sum + point.campaignPurchases,
      0
    );

    return {
      source: "spend",
      revenueSharePercent: earnings.revenueSharePercent,
      totalEstimatedEarningsCents: earnings.totalEstimatedEarningsCents,
      totalAttributedSpendCents: earnings.totalAttributedSpendCents,
      totalCampaignPurchases,
      daily: earnings.daily.map((point) => ({
        date: point.date,
        estimatedEarningsCents: point.estimatedEarningsCents,
        campaignPurchases: point.campaignPurchases,
        attributedSpendCents: point.attributedSpendCents,
      })),
    };
  } catch (error) {
    console.warn("[company-platform-client] athlete earnings failed", error);
    return null;
  }
}
