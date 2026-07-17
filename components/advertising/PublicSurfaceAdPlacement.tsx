"use client";

import { useEffect, useRef, useState } from "react";
import type { ServedCampaignCreative } from "@/lib/advertising-inventory-types";

type PublicSurfaceAdPlacementProps = {
  creative: ServedCampaignCreative;
  registerUrl: string;
};

function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  const key = "gofast-ad-session";
  let existing = sessionStorage.getItem(key);
  if (!existing) {
    existing = crypto.randomUUID();
    sessionStorage.setItem(key, existing);
  }
  return existing;
}

export function PublicSurfaceAdPlacement({ creative, registerUrl }: PublicSurfaceAdPlacementProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || registered) return;

    let visibleMs = 0;
    let lastTick = performance.now();
    let rafId = 0;
    let sent = false;

    const tick = () => {
      const now = performance.now();
      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
      const viewportRatio = Math.max(0, visibleHeight) / Math.max(rect.height, 1);
      const delta = now - lastTick;
      lastTick = now;

      if (viewportRatio >= 0.5 && rect.width > 0 && rect.height > 0) {
        visibleMs += delta;
      }

      if (!sent && visibleMs >= 1000) {
        sent = true;
        setRegistered(true);
        void fetch(registerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: creative.campaignId,
            placementKey: creative.placementKey,
            sessionId: getSessionId(),
            visibleMs: Math.round(visibleMs),
            viewportRatio: Number(viewportRatio.toFixed(2)),
            context: {
              surfaceType: creative.destinationSurfaceType,
              destinationKey: creative.destinationKey,
            },
          }),
        }).catch((error) => {
          console.warn("[PublicSurfaceAdPlacement] register failed", error);
        });
      }

      if (!sent) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [creative, registerUrl, registered]);

  if (!creative.brandCampaignCollateralUrl && !creative.ctaUrl) return null;

  return (
    <section
      ref={containerRef}
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      aria-label="Partner placement"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Partner</p>
      {creative.brandCampaignCollateralUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creative.brandCampaignCollateralUrl}
          alt={creative.campaignName}
          className="mt-3 w-full rounded-xl object-cover"
        />
      ) : null}
      {creative.ctaUrl ? (
        <a
          href={creative.ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
        >
          {creative.ctaLabel || "Learn more"}
        </a>
      ) : null}
    </section>
  );
}
