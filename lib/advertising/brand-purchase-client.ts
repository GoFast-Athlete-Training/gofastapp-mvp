export type BrandPurchaseSnapshot = {
  sourcePurchaseId: string;
  advertiserCompanyId: string;
  advertiserCompanyName: string | null;
  advertisingCandidateId: string;
  advertisingCandidateCode: string;
  creativeId: string;
  creativeName: string | null;
  brandCampaignCollateralUrl: string | null;
  ctaUrl: string | null;
  ctaLabel: string | null;
  altText: string | null;
  amountCents: number;
  currency: string;
  purchasedAt: string | null;
  startsAt: string;
  endsAt: string;
};

function resolveBrandAppUrl(): string | null {
  return (
    process.env.GOFAST_ADVERTISER_APP_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_ADVERTISER_APP_URL?.replace(/\/$/, "") ??
    null
  );
}

export async function fetchBrandPurchaseSnapshot(
  sourcePurchaseId: string,
  firebaseIdToken: string,
): Promise<BrandPurchaseSnapshot | null> {
  const base = resolveBrandAppUrl();
  if (!base) {
    throw new Error("Brand app URL is not configured");
  }

  const response = await fetch(`${base}/api/campaigns/${sourcePurchaseId}/purchase-snapshot`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${firebaseIdToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Brand snapshot failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    snapshot?: BrandPurchaseSnapshot;
  };

  return payload.snapshot ?? null;
}
