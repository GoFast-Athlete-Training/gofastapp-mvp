"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Trash2, Watch } from "lucide-react";
import api from "@/lib/api";

type ActivityLinkConflict = {
  type:
    | "standalone_workout"
    | "sibling_planned_workout"
    | "unrelated_planned_workout";
  workoutId: string;
  workoutTitle: string;
};

type CandidateActivity = {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: string | null;
  distance: number | null;
  duration: number | null;
  paceSecPerMile: number | null;
  ingestionStatus: string;
  reasonLabels: string[];
  conflict: ActivityLinkConflict | null;
};

interface Props {
  workoutId: string;
  onMatched: () => void | Promise<void>;
  /** Compact surface for training day / hub flows */
  compact?: boolean;
}

const VISIBLE_STEPS = [10, 25, Number.POSITIVE_INFINITY] as const;

function metersToMiShort(m: number | null | undefined): string | null {
  if (m == null || m <= 0) return null;
  const mi = m / 1609.34;
  return `${mi >= 10 ? Math.round(mi) : mi.toFixed(1)} mi`;
}

function formatPace(secPerMile: number | null | undefined): string | null {
  if (secPerMile == null || secPerMile <= 0) return null;
  const m = Math.floor(secPerMile / 60);
  const s = String(secPerMile % 60).padStart(2, "0");
  return `${m}:${s}/mi`;
}

function formatDuration(sec: number | null | undefined): string | null {
  if (sec == null || sec <= 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function conflictMessage(conflict: ActivityLinkConflict | null): string | null {
  if (!conflict) return null;
  if (conflict.type === "unrelated_planned_workout") {
    return `Linked to another workout: ${conflict.workoutTitle}. Unlink there first.`;
  }
  if (conflict.type === "standalone_workout") {
    return `Will move from standalone run "${conflict.workoutTitle}".`;
  }
  return `Will replace link on "${conflict.workoutTitle}".`;
}

export default function WorkoutActivityMatchPanel({
  workoutId,
  onMatched,
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [alreadyMatched, setAlreadyMatched] = useState(false);
  const [candidates, setCandidates] = useState<CandidateActivity[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [visibleStepIndex, setVisibleStepIndex] = useState(0);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        candidates: CandidateActivity[];
        matchedActivity: CandidateActivity | null;
      }>(`/workouts/${workoutId}/match-activity`);
      if (res.data?.matchedActivity) {
        setAlreadyMatched(true);
        setCandidates([]);
        setSelectedId("");
        return;
      }
      setAlreadyMatched(false);
      const list = res.data?.candidates;
      setCandidates(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Could not load activities");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const suggested = useMemo(() => candidates[0] ?? null, [candidates]);

  const visibleLimit = VISIBLE_STEPS[visibleStepIndex] ?? Number.POSITIVE_INFINITY;
  const visibleCandidates = useMemo(() => {
    if (showAllCandidates || !Number.isFinite(visibleLimit)) return candidates;
    return candidates.slice(0, visibleLimit);
  }, [candidates, showAllCandidates, visibleLimit]);

  const hiddenCount = candidates.length - visibleCandidates.length;

  useEffect(() => {
    if (suggested && !selectedId) {
      setSelectedId(suggested.id);
    }
  }, [suggested, selectedId]);

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === selectedId) ?? null,
    [candidates, selectedId]
  );

  const selectedBlocked =
    selectedCandidate?.conflict?.type === "unrelated_planned_workout";

  const confirmMatch = async () => {
    if (!selectedId || selectedBlocked) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/workouts/${workoutId}/match-activity`, {
        activityId: selectedId,
      });
      await onMatched();
    } catch (e: unknown) {
      const ax = e as {
        response?: { data?: { error?: string; conflict?: ActivityLinkConflict } };
      };
      setError(ax.response?.data?.error || "Could not match activity");
    } finally {
      setSaving(false);
    }
  };

  const deleteCandidate = async (activityId: string) => {
    if (
      !window.confirm(
        "Delete this activity from GoFast? This does not delete it from Garmin."
      )
    ) {
      return;
    }
    setDeletingId(activityId);
    setError(null);
    try {
      await api.delete(`/activities/${activityId}`);
      if (selectedId === activityId) setSelectedId("");
      await loadCandidates();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Could not delete activity");
    } finally {
      setDeletingId(null);
    }
  };

  const renderCandidate = (a: CandidateActivity, highlight?: boolean) => {
    const selected = selectedId === a.id;
    const title = (a.activityName || a.activityType || "Run").replace(/_/g, " ");
    const when = a.startTime
      ? new Date(a.startTime).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
    const dist = metersToMiShort(a.distance);
    const pace = formatPace(a.paceSecPerMile);
    const dur = formatDuration(a.duration);
    const conflictNote = conflictMessage(a.conflict);

    return (
      <div
        key={a.id}
        className={`rounded-xl border transition ${
          selected
            ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500"
            : highlight
              ? "border-emerald-200 bg-emerald-50/50"
              : "border-gray-200 bg-white"
        }`}
      >
        <button
          type="button"
          onClick={() => setSelectedId(a.id)}
          className="w-full text-left px-3 py-2.5 hover:bg-black/[0.02] rounded-xl"
        >
          <p className="text-sm font-semibold text-gray-900 line-clamp-2">{title}</p>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-600">
            {a.reasonLabels.map((label) => (
              <span
                key={label}
                className={`rounded px-1.5 py-0.5 font-medium ${
                  label === "Title match"
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {label}
              </span>
            ))}
            {when ? <span>{when}</span> : null}
            {dist ? <span>{dist}</span> : null}
            {pace ? <span>{pace}</span> : null}
            {dur ? <span>{dur}</span> : null}
          </div>
          {conflictNote ? (
            <p
              className={`mt-1 text-xs ${
                a.conflict?.type === "unrelated_planned_workout"
                  ? "text-red-700"
                  : "text-sky-800"
              }`}
            >
              {conflictNote}
            </p>
          ) : null}
        </button>
        <div className="border-t border-gray-100 px-3 py-1.5 flex justify-end">
          <button
            type="button"
            disabled={deletingId === a.id}
            onClick={() => void deleteCandidate(a.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-700 disabled:opacity-50"
          >
            {deletingId === a.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            Delete from GoFast
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        id="match-garmin-panel"
        className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-500 ${
          compact ? "mb-4" : "mb-6"
        }`}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Looking for matching Garmin activities…
      </div>
    );
  }

  if (alreadyMatched) {
    return null;
  }

  return (
    <div
      id="match-garmin-panel"
      className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden ${
        compact ? "mb-4" : "mb-6"
      }`}
    >
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
        <Watch className="h-4 w-4 text-gray-400" />
        <h2 className="font-semibold text-gray-900 text-sm">
          {compact ? "Match your Garmin run" : "Match your Garmin run"}
        </h2>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          {compact && suggested
            ? "We found a Garmin run near this workout. Use this activity?"
            : "We found activities near this workout's date. Pick the run you completed and confirm to log results and analysis."}
        </p>

        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500">
            No nearby running activities found. Sync Garmin from Training settings, then refresh
            this page.
          </p>
        ) : (
          <>
            {compact && suggested && !showAllCandidates ? (
              <div className="space-y-3">
                {renderCandidate(suggested, true)}
                {candidates.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllCandidates(true)}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    Choose another activity
                    <ChevronDown className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {visibleCandidates.map((a, index) =>
                  renderCandidate(a, index === 0 && a.reasonLabels.includes("Title match"))
                )}
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = visibleStepIndex + 1;
                      if (next >= VISIBLE_STEPS.length - 1) {
                        setVisibleStepIndex(VISIBLE_STEPS.length - 1);
                      } else {
                        setVisibleStepIndex(next);
                      }
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Show more ({hiddenCount} remaining)
                  </button>
                ) : null}
              </div>
            )}

            <button
              type="button"
              disabled={!selectedId || saving || selectedBlocked}
              onClick={() => void confirmMatch()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {saving
                ? "Matching…"
                : compact
                  ? "Use this Garmin activity"
                  : "Yes, match this activity"}
            </button>
          </>
        )}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
