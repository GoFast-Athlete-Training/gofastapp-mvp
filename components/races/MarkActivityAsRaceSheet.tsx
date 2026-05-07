"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import api from "@/lib/api";
import { formatDurationSecondsToClock } from "@/lib/race-result-helpers";

export type RaceSearchRow = {
  id: string;
  name: string;
  distanceLabel?: string | null;
  raceDate?: string | Date | null;
  city?: string | null;
  state?: string | null;
};

export type MarkActivityAsRaceSheetProps = {
  open: boolean;
  onClose: () => void;
  /** `athlete_activities.id` (same value stored as race result garminActivityId) */
  activityId: string;
  durationSeconds: number | null;
  activityLabel: string;
  onSaved?: () => void;
};

export default function MarkActivityAsRaceSheet({
  open,
  onClose,
  activityId,
  durationSeconds,
  activityLabel,
  onSaved,
}: MarkActivityAsRaceSheetProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [races, setRaces] = useState<RaceSearchRow[]>([]);
  const [selected, setSelected] = useState<RaceSearchRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  const canSearch = debouncedQuery.length >= 2;

  const loadRaces = useCallback(async () => {
    if (!canSearch) {
      setRaces([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/race/search", {
        params: { pastWindow: "true", q: debouncedQuery },
      });
      const list = res.data?.race_registry;
      setRaces(Array.isArray(list) ? list : []);
    } catch {
      setRaces([]);
      setError("Could not search races. Try again.");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, canSearch]);

  useEffect(() => {
    if (!open) return;
    void loadRaces();
  }, [open, loadRaces]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setSelected(null);
      setRaces([]);
      setError(null);
    }
  }, [open]);

  const durationLabel = useMemo(() => {
    if (durationSeconds == null || durationSeconds <= 0) return null;
    return formatDurationSecondsToClock(durationSeconds);
  }, [durationSeconds]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selected?.id) {
      setError("Choose a race from the list.");
      return;
    }
    if (durationSeconds == null || durationSeconds <= 0) {
      setError("This activity has no duration; log your result from the race hub instead.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/race-results", {
        raceRegistryId: selected.id,
        garminActivityId: activityId,
        officialFinishTime: null,
        chipTime: null,
        gunTime: null,
      });
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : "Save failed");
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const noDuration = durationSeconds == null || durationSeconds <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-activity-race-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0">
          <h2 id="mark-activity-race-title" className="text-lg font-semibold text-gray-900 pr-2">
            This was a race
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="overflow-y-auto px-5 py-4 space-y-4 flex flex-col min-h-0">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{activityLabel}</span>
            {durationLabel ? (
              <span className="text-gray-500">
                {" "}
                · duration {durationLabel} (used as finish time)
              </span>
            ) : null}
          </p>

          {noDuration ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This activity has no duration in our system. Open the race from your hub and enter your
              official time manually.
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div>
            <label htmlFor="mar-search" className="text-xs font-medium text-gray-500 block">
              Find race
            </label>
            <input
              id="mar-search"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
              placeholder="Race name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <p className="mt-0.5 text-xs text-gray-500">Type at least 2 characters · past ~90 days</p>
          </div>

          <div className="flex-1 min-h-[140px] max-h-[40vh] overflow-y-auto rounded-lg border border-gray-100">
            {!canSearch ? (
              <p className="text-sm text-gray-500 p-3">Keep typing to search past races.</p>
            ) : loading ? (
              <p className="text-sm text-gray-500 p-3">Searching…</p>
            ) : races.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">No matches. Try another name.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {races.map((r) => {
                  const dateStr =
                    r.raceDate != null
                      ? new Date(r.raceDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "";
                  const isSel = selected?.id === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 ${
                          isSel ? "bg-emerald-50" : ""
                        }`}
                      >
                        <span className="font-medium text-gray-900">{r.name}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {[dateStr, r.distanceLabel, r.city, r.state].filter(Boolean).join(" · ") ||
                            "—"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 pb-1">
            <button
              type="submit"
              disabled={saving || noDuration || !selected}
              className="inline-flex justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save race result"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
