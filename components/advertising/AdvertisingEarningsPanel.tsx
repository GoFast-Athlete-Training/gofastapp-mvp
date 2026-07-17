"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { AdvertisingMoneyCurve } from "@/components/advertising/AdvertisingMoneyCurve";
import type { SurfaceOwnerEarnings } from "@/lib/advertising/advertiser-platform-client";

type AdvertisingEarningsPanelProps = {
  athleteId: string;
  isGoFastContainer: boolean;
};

export function AdvertisingEarningsPanel({
  athleteId,
  isGoFastContainer,
}: AdvertisingEarningsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [earnings, setEarnings] = useState<SurfaceOwnerEarnings | null>(null);

  useEffect(() => {
    if (!isGoFastContainer) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/me/advertising-earnings");
        if (cancelled) return;
        setEligible(!!response.data?.eligible);
        setEarnings(response.data?.earnings ?? null);
      } catch {
        if (!cancelled) setEarnings(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [athleteId, isGoFastContainer]);

  if (!isGoFastContainer) {
    return (
      <section className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-600">
        Turn on your GoFast community container to publish a public surface brands can target.
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-500">
        Loading partner earnings…
      </section>
    );
  }

  if (!eligible || !earnings) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
        Your profile container is live in advertiser inventory. Earnings will appear once brands
        buy impressions on your page.
      </section>
    );
  }

  return (
    <AdvertisingMoneyCurve
      revenueSharePercent={earnings.revenueSharePercent}
      totalQualifiedImpressions={earnings.totalQualifiedImpressions}
      totalEstimatedEarningsCents={earnings.totalEstimatedEarningsCents}
      daily={earnings.daily}
    />
  );
}
