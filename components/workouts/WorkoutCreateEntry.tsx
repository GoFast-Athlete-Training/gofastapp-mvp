"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Library, Sparkles, Wrench, Upload, ChevronLeft } from "lucide-react";
import api from "@/lib/api";
import WorkoutShapeConfirmPanel from "@/components/training/WorkoutShapeConfirmPanel";
import type { WorkoutShape } from "@/lib/training/workout-shape-service";
import type { CatalogueBrowseItem } from "@/components/workouts/workout-create-types";
import {
  WORKOUT_SEGMENT_CSV_TEMPLATE,
  parseWorkoutSegmentsCsv,
} from "@/lib/workout/parse-workout-segments-csv";
import { workoutDetailPathWithBackHref } from "@/lib/training/workout-nav-query";

export type CreateEntryPath = "ai" | "built" | "catalogue" | "paste" | null;

type BuiltRow = {
  id: string;
  title: string;
  workoutType: string;
  date: string | null;
};

type Props = {
  path: CreateEntryPath;
  onPathChange: (path: CreateEntryPath) => void;
  builderBackHref: string;
  planDayAssignMode: boolean;
  planId: string;
  planDateKey: string;
  workoutType: string;
  onWorkoutTypeChange: (wt: string) => void;
  sourceText: string;
  onSourceTextChange: (v: string) => void;
  aiGeneratePrompt: string;
  onAiGeneratePromptChange: (v: string) => void;
  deriveError: string | null;
  deriving: boolean;
  aiGenerating: boolean;
  pendingShape: WorkoutShape | null;
  pendingShapeMeta: { suggestedTitle: string; suggestedDescription: string } | null;
  onClearPendingShape: () => void;
  onApplyShapeWithPaces: () => void;
  applyingPaces: boolean;
  onPasteBuild: () => void;
  onAiGenerate: () => void;
  onCsvSegments: (segments: import("@/lib/training/prescription").WorkoutStep[]) => void;
  presetTypeFilter: string;
  onPresetTypeFilter: (wt: string) => void;
  catalogueItems: CatalogueBrowseItem[];
  catalogueBrowseError: string | null;
  catalogueGeneratingId: string | null;
  onCataloguePreset: (item: CatalogueBrowseItem) => void;
  catalogueCardSubtitle: (item: CatalogueBrowseItem) => string;
  onUseBuiltWorkoutOnPlanDay?: (workoutId: string) => void;
};

const TYPE_CHIPS = ["Easy", "Tempo", "Intervals", "LongRun", "Race"] as const;

function catalogueByType(items: CatalogueBrowseItem[]) {
  const m = new Map<string, CatalogueBrowseItem[]>();
  for (const row of items) {
    const list = m.get(row.workoutType) ?? [];
    list.push(row);
    m.set(row.workoutType, list);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function WorkoutCreateFork({ onPick }: { onPick: (path: Exclude<CreateEntryPath, null>) => void }) {
  const cards: Array<{
    id: Exclude<CreateEntryPath, null>;
    title: string;
    body: string;
    Icon: typeof Sparkles;
  }> = [
    {
      id: "ai",
      title: "Ask AI",
      body: 'Describe what you want — e.g. "Get me a tempo 8 with a 2 mile warmup."',
      Icon: Sparkles,
    },
    {
      id: "built",
      title: "What you’ve built",
      body: "Reuse, edit, or delete standalone workouts you already saved.",
      Icon: Wrench,
    },
    {
      id: "catalogue",
      title: "Catalogue",
      body: "Pick Easy, Tempo, Intervals, or Long run — then a preset for your pace.",
      Icon: Library,
    },
    {
      id: "paste",
      title: "Your own training",
      body: "Paste a coach note or upload a CSV of segments.",
      Icon: FileText,
    },
  ];

  return (
    <div className="space-y-4 mb-8">
      <p className="text-sm text-gray-600">How do you want to build this run?</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ id, title, body, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 text-left hover:border-orange-300 hover:bg-orange-50 transition"
          >
            <Icon className="h-5 w-5 text-orange-700 mb-2" aria-hidden />
            <span className="block text-sm font-semibold text-gray-900">{title}</span>
            <span className="block text-xs text-gray-600 mt-1">{body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function WorkoutCreateEntry(props: Props) {
  const {
    path,
    onPathChange,
    builderBackHref,
    planDayAssignMode,
    planId,
    planDateKey,
    workoutType,
    onWorkoutTypeChange,
    sourceText,
    onSourceTextChange,
    aiGeneratePrompt,
    onAiGeneratePromptChange,
    deriveError,
    deriving,
    aiGenerating,
    pendingShape,
    pendingShapeMeta,
    onClearPendingShape,
    onApplyShapeWithPaces,
    applyingPaces,
    onPasteBuild,
    onAiGenerate,
    onCsvSegments,
    presetTypeFilter,
    onPresetTypeFilter,
    catalogueItems,
    catalogueBrowseError,
    catalogueGeneratingId,
    onCataloguePreset,
    catalogueCardSubtitle,
    onUseBuiltWorkoutOnPlanDay,
  } = props;

  const [builtRows, setBuiltRows] = useState<BuiltRow[]>([]);
  const [builtLoading, setBuiltLoading] = useState(false);
  const [builtError, setBuiltError] = useState<string | null>(null);
  const [builtTypeFilter, setBuiltTypeFilter] = useState("");
  const [builtSearch, setBuiltSearch] = useState("");
  const [builtOffset, setBuiltOffset] = useState(0);
  const [builtHasMore, setBuiltHasMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBuilt = useCallback(
    async (offset: number, append: boolean) => {
      setBuiltLoading(true);
      setBuiltError(null);
      try {
        const params = new URLSearchParams({
          standalone: "1",
          paged: "1",
          limit: "20",
          offset: String(offset),
        });
        if (builtTypeFilter) params.set("workoutType", builtTypeFilter);
        if (builtSearch.trim()) params.set("q", builtSearch.trim());
        const { data } = await api.get<{
          workouts?: BuiltRow[];
          hasMore?: boolean;
        }>(`workouts?${params.toString()}`);
        const rows = data.workouts ?? [];
        setBuiltRows((prev) => (append ? [...prev, ...rows] : rows));
        setBuiltHasMore(Boolean(data.hasMore));
        setBuiltOffset(offset);
      } catch {
        setBuiltError("Could not load your workouts.");
        if (!append) setBuiltRows([]);
      } finally {
        setBuiltLoading(false);
      }
    },
    [builtTypeFilter, builtSearch]
  );

  useEffect(() => {
    if (path !== "built") return;
    void loadBuilt(0, false);
  }, [path, loadBuilt]);

  const groupedCatalogue = useMemo(() => catalogueByType(catalogueItems), [catalogueItems]);

  if (path === null) {
    return <WorkoutCreateFork onPick={(p) => onPathChange(p)} />;
  }

  const backToFork = (
    <button
      type="button"
      onClick={() => onPathChange(null)}
      className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
    >
      <ChevronLeft className="h-4 w-4" />
      All options
    </button>
  );

  if (path === "ai") {
    return (
      <div className="mb-8">
        {backToFork}
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Ask AI</h2>
        <p className="text-sm text-gray-600 mb-3">
          Uses your threshold pace, 5K baseline, and recent runs.
        </p>
        <div className="mb-3 max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Workout type</label>
          <select
            value={workoutType}
            onChange={(e) => onWorkoutTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500"
          >
            {TYPE_CHIPS.filter((t) => t !== "Race").map((t) => (
              <option key={t} value={t}>
                {t === "LongRun" ? "Long run" : t}
              </option>
            ))}
          </select>
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Get me a workout that…
        </label>
        <textarea
          value={aiGeneratePrompt}
          onChange={(e) => onAiGeneratePromptChange(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          placeholder="e.g. tempo 8 with 2 mi warmup after yesterday's long run"
        />
        {deriveError ? <p className="text-sm text-red-600 mt-2">{deriveError}</p> : null}
        <button
          type="button"
          onClick={() => void onAiGenerate()}
          disabled={aiGenerating}
          className="mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {aiGenerating ? "Generating…" : "Generate workout"}
        </button>
      </div>
    );
  }

  if (path === "built") {
    return (
      <div className="mb-8">
        {backToFork}
        <h2 className="text-lg font-semibold text-gray-900 mb-2">What you&apos;ve built</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => setBuiltTypeFilter("")}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              !builtTypeFilter ? "border-orange-600 bg-orange-600 text-white" : "border-gray-300 bg-white"
            }`}
          >
            All types
          </button>
          {TYPE_CHIPS.map((wt) => (
            <button
              key={wt}
              type="button"
              onClick={() => setBuiltTypeFilter(wt)}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                builtTypeFilter === wt
                  ? "border-orange-600 bg-orange-600 text-white"
                  : "border-gray-300 bg-white"
              }`}
            >
              {wt === "LongRun" ? "Long run" : wt}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={builtSearch}
          onChange={(e) => setBuiltSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void loadBuilt(0, false);
          }}
          placeholder="Search by title"
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg mb-2"
        />
        <button
          type="button"
          onClick={() => void loadBuilt(0, false)}
          className="text-sm text-sky-800 hover:underline mb-3"
        >
          Apply filter
        </button>
        {builtError ? <p className="text-sm text-red-600">{builtError}</p> : null}
        {builtLoading && builtRows.length === 0 ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : builtRows.length === 0 ? (
          <p className="text-sm text-gray-600">No standalone workouts match.</p>
        ) : (
          <ul className="space-y-3 list-none pl-0 m-0">
            {builtRows.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">{w.title}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {w.workoutType}
                    {w.date ? ` · ${String(w.date).slice(0, 10)}` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Link
                    href={workoutDetailPathWithBackHref(w.id, builderBackHref)}
                    className="text-sky-800 hover:underline"
                  >
                    Edit
                  </Link>
                  {planDayAssignMode && onUseBuiltWorkoutOnPlanDay ? (
                    <button
                      type="button"
                      className="text-orange-700 hover:underline"
                      onClick={() => void onUseBuiltWorkoutOnPlanDay(w.id)}
                    >
                      Use on this day
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={deletingId === w.id}
                    className="text-red-700 hover:underline disabled:opacity-50"
                    onClick={async () => {
                      if (!confirm(`Delete "${w.title}"?`)) return;
                      setDeletingId(w.id);
                      try {
                        await api.delete("workouts", { data: { ids: [w.id] } });
                        setBuiltRows((prev) => prev.filter((r) => r.id !== w.id));
                      } catch {
                        alert("Could not delete workout.");
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {builtHasMore ? (
          <button
            type="button"
            className="mt-3 text-sm text-sky-800 hover:underline"
            disabled={builtLoading}
            onClick={() => void loadBuilt(builtOffset + 20, true)}
          >
            Load more
          </button>
        ) : null}
      </div>
    );
  }

  if (path === "catalogue") {
    return (
      <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
        {backToFork}
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Catalogue</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {(["Easy", "Tempo", "Intervals", "LongRun"] as const).map((wt) => (
            <button
              key={wt}
              type="button"
              onClick={() => {
                onPresetTypeFilter(wt);
                onWorkoutTypeChange(wt);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${
                presetTypeFilter === wt
                  ? "border-orange-600 bg-orange-600 text-white"
                  : "border-gray-300 bg-white text-gray-800"
              }`}
            >
              {wt === "LongRun" ? "Long run" : wt}
            </button>
          ))}
        </div>
        {catalogueBrowseError != null && (
          <p className="text-sm text-amber-800 mb-2">{catalogueBrowseError}</p>
        )}
        {!presetTypeFilter ? (
          <p className="text-sm text-gray-500">Pick a workout type above.</p>
        ) : catalogueItems.length === 0 && catalogueBrowseError == null ? (
          <p className="text-sm text-gray-500">Loading presets…</p>
        ) : (
          <div className="space-y-6">
            {groupedCatalogue.map(([wt, items]) => (
              <div key={wt}>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{wt}</h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={catalogueGeneratingId != null}
                      onClick={() => void onCataloguePreset(item)}
                      className={`text-left rounded-lg border px-3 py-2 text-sm max-w-[min(100%,280px)] transition-colors ${
                        catalogueGeneratingId === item.id
                          ? "border-orange-400 bg-orange-50"
                          : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"
                      } disabled:opacity-50`}
                    >
                      <span className="font-semibold text-gray-900 block">{item.name}</span>
                      <span className="text-xs text-gray-600 block mt-0.5">
                        {catalogueCardSubtitle(item)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-8">
      {backToFork}
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Your own training</h2>
      <p className="text-sm text-gray-600 mb-3">
        Paste from a coach or upload a CSV. We read the shape and your paces — no AI on this path unless
        parsing fails.
      </p>
      <textarea
        value={sourceText}
        onChange={(e) => onSourceTextChange(e.target.value)}
        rows={8}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        placeholder="Paste your workout note here…"
      />
      {deriveError ? <p className="text-sm text-red-600 mt-1">{deriveError}</p> : null}
      {pendingShape ? (
        <WorkoutShapeConfirmPanel
          shape={pendingShape}
          onConfirm={onApplyShapeWithPaces}
          onBack={onClearPendingShape}
          applying={applyingPaces}
        />
      ) : (
        <button
          type="button"
          onClick={onPasteBuild}
          disabled={deriving}
          className="mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          {deriving ? "Parsing…" : "Build from paste"}
        </button>
      )}

      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload CSV
        </h3>
        <p className="text-xs text-gray-600 mb-2">
          Columns: title, durationType (DISTANCE or TIME), durationValue, pace (M:SS), optional repeatCount.
        </p>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(WORKOUT_SEGMENT_CSV_TEMPLATE)}`}
          download="workout-segments-template.csv"
          className="text-sm text-sky-800 hover:underline"
        >
          Download template
        </a>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-3 block text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            const parsed = parseWorkoutSegmentsCsv(text);
            if (parsed.error) {
              alert(parsed.error);
              return;
            }
            onCsvSegments(parsed.steps);
          }}
        />
      </div>
    </div>
  );
}
