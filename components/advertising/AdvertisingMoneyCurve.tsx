"use client";

type AdvertisingMoneyCurveProps = {
  revenueSharePercent: number;
  totalQualifiedImpressions: number;
  totalEstimatedEarningsCents: number;
  daily: Array<{
    date: string;
    qualifiedImpressions: number;
    estimatedEarningsCents: number;
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
  totalQualifiedImpressions,
  totalEstimatedEarningsCents,
  daily,
}: AdvertisingMoneyCurveProps) {
  const maxImpressions = Math.max(1, ...daily.map((point) => point.qualifiedImpressions));

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Partner earnings</h2>
          <p className="mt-1 text-sm text-stone-600">
            Your public container is advertiser inventory. Earnings update from qualified
            impressions on campaigns targeting your page ({revenueSharePercent}% share).
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-stone-900">
            {formatUsd(totalEstimatedEarningsCents)}
          </div>
          <div className="text-xs text-stone-500">
            {totalQualifiedImpressions} qualified impressions (30d)
          </div>
        </div>
      </div>

      {daily.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">
          No qualified impressions yet. When brands buy your profile container, earnings will
          show here.
        </p>
      ) : (
        <div className="mt-5 flex items-end gap-1 h-28">
          {daily.map((point) => {
            const heightPct = Math.max(8, (point.qualifiedImpressions / maxImpressions) * 100);
            return (
              <div key={point.date} className="group flex-1 min-w-0">
                <div
                  className="mx-auto w-full max-w-[18px] rounded-t bg-orange-500/80 transition-colors group-hover:bg-orange-600"
                  style={{ height: `${heightPct}%` }}
                  title={`${point.date}: ${point.qualifiedImpressions} impressions · ${formatUsd(point.estimatedEarningsCents)}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
