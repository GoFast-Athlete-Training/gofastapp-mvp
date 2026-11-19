"use client";

import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { useCallback, useEffect, useState } from "react";

export type BlueprintReadinessPayload = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  presetId: string | null;
  presetTitle: string | null;
  presetSlug: string | null;
  totalWeeks: number;
  weeksToGoal: number;
  buildWeekCount: number;
  taperWeekCount: number;
  hasBuild: boolean;
  hasTaper: boolean;
  hasRaceWeek: boolean;
  hasEasyRotation: boolean;
  taperUsesPresetCaps: boolean;
  shortPlanWarning: string | null;
};

export function PlanBlueprintReadinessPanel({
  planId,
  getToken,
}: {
  planId: string;
  getToken: () => Promise<string | null>;
}) {
  const [readiness, setReadiness] = useState<BlueprintReadinessPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadReadiness = useCallback(async () => {
    setLoadError(null);
    try {
      const token = await getToken();
      if (!token) {
        setLoadError("Sign in to load blueprint readiness");
        setReadiness(null);
        return;
      }
      const res = await fetch(
        `/api/training/plan/blueprint-readiness?planId=${encodeURIComponent(planId)}`,
        { headers: athleteBearerFetchHeaders(token) },
      );
      const data = (await res.json()) as BlueprintReadinessPayload & { error?: string };
      if (!res.ok) {
        setLoadError(data.error ?? "Could not load blueprint readiness");
        setReadiness(null);
        return;
      }
      setReadiness(data);
    } catch {
      setLoadError("Could not load blueprint readiness");
      setReadiness(null);
    }
  }, [getToken, planId]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  if (loadError) {
    return <p className="text-sm text-amber-900">{loadError}</p>;
  }
  if (!readiness) return null;

  const notes = [
    ...readiness.errors,
    ...(readiness.shortPlanWarning ? [readiness.shortPlanWarning] : []),
  ];
  if (notes.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
      role="status"
    >
      {notes.map((note) => (
        <p key={note} className="mt-1 first:mt-0">
          {note}
        </p>
      ))}
    </div>
  );
}
