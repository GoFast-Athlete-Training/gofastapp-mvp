"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { CATALOGUE_ROTATION_SLOTS } from "@/lib/training/athlete-rotation-constants";
import {
  recommendQualityCatalogueIds,
  isRecommendedCatalogueId,
  type CatalogueRecommendRow,
} from "@/lib/training/recommend-quality-catalogue";
import type { WeeklyVolumeBand } from "@/lib/training/weekly-volume-key";

export type QualityCatalogueItem = CatalogueRecommendRow;

type Props = {
  workoutType: "Tempo" | "Intervals";
  templateSeedIds: string[];
  weeklyVolumeBand?: WeeklyVolumeBand | null;
  progressionAggressiveness?: string | null;
  initialSelectedIds?: string[];
  getToken: () => Promise<string>;
  onContinue: (selectedIds: string[]) => void;
  saving?: boolean;
};

export function QualityCataloguePicker({
  workoutType,
  templateSeedIds,
  weeklyVolumeBand,
  progressionAggressiveness,
  initialSelectedIds,
  getToken,
  onContinue,
  saving = false,
}: Props) {
  const [catalogue, setCatalogue] = useState<QualityCatalogueItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const recommendedIds = useMemo(
    () =>
      recommendQualityCatalogueIds({
        catalogue,
        templateSeedIds,
        weeklyVolumeBand,
        progressionAggressiveness,
      }),
    [catalogue, templateSeedIds, weeklyVolumeBand, progressionAggressiveness]
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/workouts/catalogue-browse?workoutType=${encodeURIComponent(workoutType)}`,
          { headers: athleteBearerFetchHeaders(token) }
        );
        const data = (await res.json()) as {
          items?: QualityCatalogueItem[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not load catalogue");
        }
        setCatalogue(data.items ?? []);
      } catch (e) {
        setCatalogue([]);
        setLoadError(e instanceof Error ? e.message : "Could not load catalogue");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken, workoutType]);

  useEffect(() => {
    if (loading || initialized || catalogue.length === 0) return;

    const seed = initialSelectedIds?.filter(Boolean) ?? [];
    if (seed.length > 0) {
      const valid = seed.filter((id) => catalogue.some((c) => c.id === id));
      setSelectedIds(valid.slice(0, CATALOGUE_ROTATION_SLOTS));
    } else {
      setSelectedIds(recommendedIds);
    }
    setInitialized(true);
  }, [loading, initialized, catalogue, initialSelectedIds, recommendedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= CATALOGUE_ROTATION_SLOTS) return prev;
      return [...prev, id];
    });
  }, []);

  const atMax = selectedIds.length >= CATALOGUE_ROTATION_SLOTS;

  if (loading) {
    return <p className="text-sm text-gray-600">Loading workout catalogue…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-700">{loadError}</p>;
  }

  if (catalogue.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        No {workoutType.toLowerCase()} workouts are in the catalogue yet.
      </p>
    );
  }

  const typeLabel = workoutType === "Tempo" ? "tempo" : "interval";

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-gray-600">
        Selected {selectedIds.length} / {CATALOGUE_ROTATION_SLOTS} — pick how many {typeLabel}{" "}
        workouts you want in your rotation.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {catalogue.map((item) => {
          const checked = selectedIds.includes(item.id);
          const recommended = isRecommendedCatalogueId(recommendedIds, item.id);
          const disabled = !checked && atMax;

          return (
            <label
              key={item.id}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                checked
                  ? "border-orange-400 bg-orange-50/60"
                  : disabled
                    ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                    : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(item.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                  {recommended ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-800">
                      Recommended
                    </span>
                  ) : null}
                </span>
                {item.description?.trim() ? (
                  <span className="mt-1 block text-xs text-gray-600 line-clamp-2">
                    {item.description.trim()}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        disabled={saving || selectedIds.length === 0}
        onClick={() => onContinue(selectedIds)}
        className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : "I'm good"}
      </button>
    </div>
  );
}
