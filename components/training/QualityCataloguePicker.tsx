"use client";

import { useCallback, useEffect, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { AthleteCatalogueEditForm } from "@/components/training/AthleteCatalogueEditForm";
import type { QualityCatalogueItem } from "@/components/training/quality-catalogue-types";
import { CATALOGUE_ROTATION_SLOTS } from "@/lib/training/athlete-rotation-constants";
import {
  isRecommendedCatalogueId,
} from "@/lib/training/recommend-quality-catalogue";
import {
  catalogueDetailLines,
  catalogueHasDetails,
} from "@/lib/training/catalogue-details-format";
import type { WeeklyVolumeBand } from "@/lib/training/weekly-volume-key";

type Props = {
  presetId: string;
  workoutType: "Tempo" | "Intervals";
  templateSeedIds: string[];
  weeklyVolumeBand?: WeeklyVolumeBand | null;
  progressionAggressiveness?: string | null;
  initialSelectedIds?: string[];
  getToken: () => Promise<string>;
  onContinue: (selectedIds: string[]) => void;
  saving?: boolean;
};

function CatalogueDetailsBlock({ item }: { item: QualityCatalogueItem }) {
  const lines = catalogueDetailLines(item);
  if (lines.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-600">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

export function QualityCataloguePicker({
  presetId,
  workoutType,
  templateSeedIds: _templateSeedIds,
  weeklyVolumeBand: _weeklyVolumeBand,
  progressionAggressiveness: _progressionAggressiveness,
  initialSelectedIds,
  getToken,
  onContinue,
  saving = false,
}: Props) {
  const [catalogue, setCatalogue] = useState<QualityCatalogueItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [createDescription, setCreateDescription] = useState("");
  const [aiPrefill, setAiPrefill] = useState<Record<string, unknown> | null>(null);
  const [catalogueDraftKey, setCatalogueDraftKey] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadCatalogue = useCallback(async () => {
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
  }, [getToken, workoutType]);

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  useEffect(() => {
    if (loading || initialized) return;

    if (catalogue.length === 0) {
      setSelectedIds([]);
      setInitialized(true);
      return;
    }

    const seed = initialSelectedIds?.filter(Boolean) ?? [];
    if (seed.length > 0) {
      const valid = seed.filter((id) => catalogue.some((c) => c.id === id));
      setSelectedIds(valid.slice(0, CATALOGUE_ROTATION_SLOTS));
    } else {
      setSelectedIds([]);
    }
    setInitialized(true);
  }, [loading, initialized, catalogue, initialSelectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= CATALOGUE_ROTATION_SLOTS) return prev;
      return [...prev, id];
    });
  }, []);

  const selectAllCatalogue = useCallback(() => {
    setSelectedIds(catalogue.slice(0, CATALOGUE_ROTATION_SLOTS).map((c) => c.id));
  }, [catalogue]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  function appendCatalogueItem(item: QualityCatalogueItem) {
    setCatalogue((prev) => {
      const next = [...prev.filter((c) => c.id !== item.id), item];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  const recommendForMe = useCallback(async () => {
    setRecommending(true);
    setRecommendError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/athlete-presets/${presetId}/recommend-quality`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({ workoutType }),
      });
      const data = (await res.json()) as {
        created?: QualityCatalogueItem[];
        error?: string;
      };
      if (!res.ok || !Array.isArray(data.created) || data.created.length === 0) {
        throw new Error(data.error ?? "Could not generate recommendations");
      }
      const newIds = data.created.map((c) => c.id);
      setCatalogue((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        for (const item of data.created!) {
          byId.set(item.id, item);
        }
        return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
      });
      setRecommendedIds((prev) => [...new Set([...prev, ...newIds])]);
    } catch (e) {
      setRecommendError(e instanceof Error ? e.message : "Could not generate recommendations");
    } finally {
      setRecommending(false);
    }
  }, [getToken, presetId, workoutType]);

  async function runGenerateEntry() {
    const description = createDescription.trim();
    if (!description) {
      setCreateError("Describe your workout first");
      return;
    }
    setParsing(true);
    setCreateError(null);
    setAiPrefill(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/workouts/athlete-catalogue/ai-parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({ description, workoutType }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        fields?: Record<string, unknown>;
        error?: string;
        details?: string;
      };
      if (!res.ok || !data.fields) {
        throw new Error(data.details ?? data.error ?? "Could not parse workout");
      }
      setAiPrefill(data.fields);
      setCatalogueDraftKey((k) => k + 1);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Could not parse workout");
    } finally {
      setParsing(false);
    }
  }

  function clearCreateState() {
    setShowCreate(false);
    setCreateError(null);
    setCreateDescription("");
    setAiPrefill(null);
  }

  function handleSavedItem(item: QualityCatalogueItem) {
    appendCatalogueItem(item);
    setSelectedIds((prev) => {
      if (prev.includes(item.id)) return prev;
      if (prev.length >= CATALOGUE_ROTATION_SLOTS) return prev;
      return [...prev, item.id];
    });
    clearCreateState();
  }

  const atMax = selectedIds.length >= CATALOGUE_ROTATION_SLOTS;
  const typeLabel = workoutType === "Tempo" ? "tempo" : "interval";
  const selectableCount = Math.min(catalogue.length, CATALOGUE_ROTATION_SLOTS);
  const allSelectableSelected =
    selectableCount > 0 &&
    catalogue.slice(0, CATALOGUE_ROTATION_SLOTS).every((c) => selectedIds.includes(c.id));

  if (loading) {
    return <p className="text-sm text-gray-600">Loading workout catalogue…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-700">{loadError}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Select the {typeLabel} workouts you want in your plan — up to {CATALOGUE_ROTATION_SLOTS}.
        Pick from the catalogue below, get AI recommendations, or create your own.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-medium text-gray-600">
            {selectedIds.length} selected · max {CATALOGUE_ROTATION_SLOTS}
          </p>
          {catalogue.length > 0 ? (
            <>
              {!allSelectableSelected ? (
                <button
                  type="button"
                  onClick={selectAllCatalogue}
                  className="text-xs font-semibold text-orange-700 hover:text-orange-900"
                >
                  Select all{selectableCount < catalogue.length ? ` (${selectableCount})` : ""}
                </button>
              ) : null}
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  Clear
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        <button
          type="button"
          disabled={recommending}
          onClick={() => void recommendForMe()}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
        >
          {recommending ? "Creating recommendations…" : "Recommend some workouts for me"}
        </button>
      </div>
      {recommendError ? <p className="text-sm text-red-700">{recommendError}</p> : null}
      {recommendedIds.length > 0 ? (
        <p className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900">
          {recommendedIds.length} AI-recommended workout{recommendedIds.length === 1 ? "" : "s"} added
          to your catalogue (badge: Recommended). Mix with staff workouts — check the ones you want.
        </p>
      ) : null}

      {catalogue.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No {typeLabel} workouts in the catalogue yet — use Recommend or create your own below.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {catalogue.map((item) => {
            const checked = selectedIds.includes(item.id);
            const recommended = isRecommendedCatalogueId(recommendedIds, item.id);
            const isOwn = Boolean(item.ownerAthleteId);
            const disabled = !checked && atMax;
            const hasDetails = catalogueHasDetails(item);
            const detailsOpen = expandedDetails[item.id] ?? false;

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
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800">
                        Recommended
                      </span>
                    ) : null}
                    {isOwn ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                        Yours
                      </span>
                    ) : null}
                  </span>
                  {item.description?.trim() ? (
                    <span className="mt-1 block text-xs text-gray-600 line-clamp-2">
                      {item.description.trim()}
                    </span>
                  ) : null}
                  {hasDetails ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpandedDetails((prev) => ({
                          ...prev,
                          [item.id]: !detailsOpen,
                        }));
                      }}
                      className="mt-1 text-[11px] font-semibold text-orange-700 hover:text-orange-900"
                    >
                      {detailsOpen ? "Hide details" : "Details"}
                    </button>
                  ) : null}
                  {detailsOpen ? <CatalogueDetailsBlock item={item} /> : null}
                </span>
              </label>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4">
        {!showCreate ? (
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setCreateError(null);
              setAiPrefill(null);
            }}
            className="text-sm font-semibold text-orange-700 hover:text-orange-900"
          >
            + Create your own
          </button>
        ) : (
          <div className="space-y-3">
            {!aiPrefill ? (
              <>
                <p className="text-sm font-medium text-gray-900">Create your own {typeLabel} workout</p>
                <p className="text-xs text-gray-600">
                  You already have workout text — AI parses it into structured catalogue fields. Review
                  and save.
                </p>
                <textarea
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono"
                  rows={4}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder={
                    workoutType === "Tempo"
                      ? 'e.g. "Tempo run. 1 mile easy warmup, 2 miles at threshold + 30 sec/mi, 1 mile cooldown."'
                      : 'e.g. "6×800 @ 5K pace, 400m jog, 1.5mi WU / 1mi CD"'
                  }
                />
                {createError ? <p className="text-sm text-red-700">{createError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={parsing || !createDescription.trim()}
                    onClick={() => void runGenerateEntry()}
                    className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                  >
                    {parsing ? "Generating…" : "Generate entry"}
                  </button>
                  <button
                    type="button"
                    onClick={clearCreateState}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900">
                  Entry pre-filled below — review and save.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAiPrefill(null);
                    setCreateError(null);
                  }}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  Start over
                </button>
                <AthleteCatalogueEditForm
                  key={`draft-${catalogueDraftKey}`}
                  workoutType={workoutType}
                  aiPrefill={aiPrefill}
                  getToken={getToken}
                  onCancel={clearCreateState}
                  onSaved={handleSavedItem}
                />
              </>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={saving || selectedIds.length === 0}
        onClick={() => onContinue(selectedIds)}
        className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {saving
          ? "Adding…"
          : selectedIds.length === 0
            ? "Select workouts to continue"
            : selectedIds.length === 1
              ? "Add 1 workout to my plan"
              : `Add ${selectedIds.length} workouts to my plan`}
      </button>
    </div>
  );
}

export type { QualityCatalogueItem } from "@/components/training/quality-catalogue-types";
