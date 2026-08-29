"use client";

import { useCallback, useEffect, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { CATALOGUE_ROTATION_SLOTS } from "@/lib/training/athlete-rotation-constants";
import {
  isRecommendedCatalogueId,
  type CatalogueRecommendRow,
} from "@/lib/training/recommend-quality-catalogue";
import {
  catalogueDetailLines,
  catalogueHasDetails,
} from "@/lib/training/catalogue-details-format";
import type { WeeklyVolumeBand } from "@/lib/training/weekly-volume-key";

export type QualityCatalogueItem = CatalogueRecommendRow & {
  ownerAthleteId?: string | null;
  workoutType?: string | null;
  warmupMiles?: number | null;
  warmupPaceOffsetSecPerMile?: number | null;
  cooldownMiles?: number | null;
  cooldownPaceOffsetSecPerMile?: number | null;
  workBaseMiles?: number | null;
  workPaceOffsetSecPerMile?: number | null;
  workBasePaceOffsetSecPerMile?: number | null;
  recoveryDistanceMeters?: number | null;
  recoveryDurationSeconds?: number | null;
};

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
  templateSeedIds,
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
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [parsedFields, setParsedFields] = useState<Record<string, unknown> | null>(null);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
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

  const applyRecommended = useCallback(async () => {
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
        body: JSON.stringify({
          workoutType,
          templateSeedIds,
        }),
      });
      const data = (await res.json()) as {
        catalogueIds?: string[];
        error?: string;
      };
      if (!res.ok || !Array.isArray(data.catalogueIds)) {
        throw new Error(data.error ?? "Could not get recommendations");
      }
      const valid = data.catalogueIds.filter((id) => catalogue.some((c) => c.id === id));
      setRecommendedIds(valid);
      setSelectedIds(valid.slice(0, CATALOGUE_ROTATION_SLOTS));
    } catch (e) {
      setRecommendError(e instanceof Error ? e.message : "Could not get recommendations");
    } finally {
      setRecommending(false);
    }
  }, [catalogue, getToken, presetId, templateSeedIds, workoutType]);

  async function handleParse() {
    const description = createDescription.trim();
    if (!description) {
      setCreateError("Paste your workout structure (e.g. 1mi WU / 2mi tempo @ +30 / 1mi CD)");
      return;
    }
    setParsing(true);
    setCreateError(null);
    setParsedFields(null);
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
      setParsedFields(data.fields);
      const parsedName = typeof data.fields.name === "string" ? data.fields.name.trim() : "";
      if (parsedName && !createName.trim()) {
        setCreateName(parsedName);
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Could not parse workout");
    } finally {
      setParsing(false);
    }
  }

  async function handleCreate() {
    const name = createName.trim();
    if (!name) {
      setCreateError("Name your workout");
      return;
    }
    if (!parsedFields) {
      setCreateError("Parse your workout description first");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/workouts/athlete-catalogue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          name,
          description: createDescription.trim() || null,
          workoutType,
          parsedFields,
        }),
      });
      const data = (await res.json()) as {
        item?: QualityCatalogueItem;
        error?: string;
      };
      if (!res.ok || !data.item) {
        throw new Error(data.error ?? "Could not create workout");
      }
      const item = data.item;
      setCatalogue((prev) => {
        const next = [...prev.filter((c) => c.id !== item.id), item];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedIds((prev) => {
        if (prev.includes(item.id)) return prev;
        if (prev.length >= CATALOGUE_ROTATION_SLOTS) return prev;
        return [...prev, item.id];
      });
      setCreateName("");
      setCreateDescription("");
      setParsedFields(null);
      setShowCreate(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Could not create workout");
    } finally {
      setCreating(false);
    }
  }

  const atMax = selectedIds.length >= CATALOGUE_ROTATION_SLOTS;
  const typeLabel = workoutType === "Tempo" ? "tempo" : "interval";
  const previewItem: QualityCatalogueItem | null = parsedFields
    ? {
        id: "preview",
        name: createName.trim() || "Preview",
        workoutType,
        warmupMiles: parsedFields.warmupMiles as number | null | undefined,
        warmupPaceOffsetSecPerMile: parsedFields.warmupPaceOffsetSecPerMile as
          | number
          | null
          | undefined,
        cooldownMiles: parsedFields.cooldownMiles as number | null | undefined,
        cooldownPaceOffsetSecPerMile: parsedFields.cooldownPaceOffsetSecPerMile as
          | number
          | null
          | undefined,
        workBaseMiles: parsedFields.workBaseMiles as number | null | undefined,
        workPaceOffsetSecPerMile: parsedFields.workPaceOffsetSecPerMile as
          | number
          | null
          | undefined,
        workBaseReps: parsedFields.workBaseReps as number | null | undefined,
        workBaseRepMeters: parsedFields.workBaseRepMeters as number | null | undefined,
        workBasePaceOffsetSecPerMile: parsedFields.workBasePaceOffsetSecPerMile as
          | number
          | null
          | undefined,
        recoveryDistanceMeters: parsedFields.recoveryDistanceMeters as number | null | undefined,
        recoveryDurationSeconds: parsedFields.recoveryDurationSeconds as number | null | undefined,
      }
    : null;

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
        Don&apos;t see what you want? Create your own below.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-600">
          {selectedIds.length} selected · max {CATALOGUE_ROTATION_SLOTS}
        </p>
        <button
          type="button"
          disabled={recommending || catalogue.length === 0}
          onClick={() => void applyRecommended()}
          className="text-xs font-semibold text-orange-700 hover:text-orange-900 disabled:opacity-60"
        >
          {recommending
            ? "Finding recommendations…"
            : recommendedIds.length > 0
              ? `Use recommended (${recommendedIds.length})`
              : "Use recommended"}
        </button>
      </div>
      {recommendError ? <p className="text-sm text-red-700">{recommendError}</p> : null}

      {catalogue.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No {typeLabel} workouts in the catalogue yet — create your own below.
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
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-800">
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
              setParsedFields(null);
            }}
            className="text-sm font-semibold text-orange-700 hover:text-orange-900"
          >
            + Create your own
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">Create your own {typeLabel} workout</p>
            <p className="text-xs text-gray-600">
              Paste like a coach would — e.g. &quot;1mi WU easy, 2mi tempo @ threshold, 1mi CD&quot;
              or &quot;6×800 @ 5K with 400m jog&quot;.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Workout description
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono"
                rows={4}
                value={createDescription}
                onChange={(e) => {
                  setCreateDescription(e.target.value);
                  setParsedFields(null);
                }}
                placeholder={
                  workoutType === "Tempo"
                    ? "2mi tempo @ threshold, 1mi WU / 1mi CD"
                    : "6×800 @ 5K pace, 400m jog, 1.5mi WU / 1mi CD"
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={`My ${workoutType === "Tempo" ? "tempo" : "interval"} workout`}
              />
            </div>
            {previewItem && catalogueHasDetails(previewItem) ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2">
                <p className="text-xs font-semibold text-sky-900">Parsed structure</p>
                <CatalogueDetailsBlock item={previewItem} />
              </div>
            ) : null}
            {createError ? <p className="text-sm text-red-700">{createError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={parsing || !createDescription.trim()}
                onClick={() => void handleParse()}
                className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-60"
              >
                {parsing ? "Parsing…" : "Parse workout"}
              </button>
              <button
                type="button"
                disabled={creating || !parsedFields}
                onClick={() => void handleCreate()}
                className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {creating ? "Adding…" : "Add to catalogue"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                  setParsedFields(null);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
              >
                Cancel
              </button>
            </div>
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
