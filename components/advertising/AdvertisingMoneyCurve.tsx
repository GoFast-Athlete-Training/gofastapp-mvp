"use client";

type AdvertisingMoneyCurveProps = {
  revenueSharePercent: number;
  source?: "spend" | "impressions";
  totalEstimatedEarningsCents: number;
  totalQualifiedImpressions?: number;
  totalCampaignPurchases?: number;
  totalAttributedSpendCents?: number;
  daily: Array<{
    date: string;
    estimatedEarningsCents: number;
    qualifiedImpressions?: number;
    campaignPurchases?: number;
    attributedSpendCents?: number;
  }>;
};

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function AdvertisingMoneyCurve({
  revenueSharePercent,
  source = "spend",
  totalEstimatedEarningsCents,
  totalQualifiedImpressions = 0,
  totalCampaignPurchases = 0,
  totalAttributedSpendCents = 0,
  daily,
}: AdvertisingMoneyCurveProps) {
  const barValues = daily.map((point) =>
    source === "spend"
      ? (point.campaignPurchases ?? 0)
      : (point.qualifiedImpressions ?? 0)
  );
  const maxBar = Math.max(1, ...barValues);

  const subtitle =
    source === "spend"
      ? `${formatUsd(totalAttributedSpendCents)} attributed spend · ${totalCampaignPurchases} campaign purchase${totalCampaignPurchases === 1 ? "" : "s"} (30d)`
      : `${totalQualifiedImpressions} qualified impressions (30d)`;

  const description =
    source === "spend"
      ? `Your share of brand campaign spend on your public container (${revenueSharePercent}%).`
      : `Estimated from qualified impressions on campaigns targeting your page (${revenueSharePercent}% share).`;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Partner earnings</h2>
          <p className="mt-1 text-sm text-stone-600">{description}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-stone-900">
            {formatUsd(totalEstimatedEarningsCents)}
          </div>
          <div className="text-xs text-stone-500">{subtitle}</div>
        </div>
      </div>

      {daily.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">
          No earnings yet. When brands purchase campaigns on your profile container, your share
          will show here.
        </p>
      ) : (
        <div className="mt-5 flex items-end gap-1 h-28">
          {daily.map((point, index) => {
            const barValue = barValues[index] ?? 0;
            const heightPct = Math.max(8, (barValue / maxBar) * 100);
            const title =
              source === "spend"
                ? `${point.date}: ${point.campaignPurchases ?? 0} purchase(s) · ${formatUsd(point.estimatedEarningsCents)}`
                : `${point.date}: ${point.qualifiedImpressions ?? 0} impressions · ${formatUsd(point.estimatedEarningsCents)}`;
            return (
              <div key={point.date} className="group flex-1 min-w-0">
                <div
                  className="mx-auto w-full max-w-[18px] rounded-t bg-orange-500/80 transition-colors group-hover:bg-orange-600"
                  style={{ height: `${heightPct}%` }}
                  title={title}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
