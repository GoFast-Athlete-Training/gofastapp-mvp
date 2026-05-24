"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Link2Off, Loader2, Trash2, Watch } from "lucide-react";
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
  /** Planned workout title for inline context */
  workoutTitle?: string | null;
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

function activityDisplayTitle(a: Pick<CandidateActivity, "activityName" | "activityType">): string {
  return (a.activityName || a.activityType || "Run").replace(/_/g, " ");
}

function conflictMessage(conflict: ActivityLinkConflict | null): string | null {
  if (!conflict) return null;
  if (conflict.type === "unrelated_planned_workout") {
    return `Linked to another planned workout: ${conflict.workoutTitle}. Unlink that workout first.`;
  }
  return `Looks like the right Garmin run. It's attached to an older duplicate workout — confirming moves it here.`;
}

function isRepairableConflict(conflict: ActivityLinkConflict | null): boolean {
  return (
    conflict?.type === "standalone_workout" ||
    conflict?.type === "sibling_planned_workout"
  );
}

function confirmButtonLabel(
  selected: CandidateActivity | null,
  suggested: CandidateActivity | null,
  saving: boolean
): string {
  if (saving) return "Matching…";
  if (!selected) return "Use this Garmin activity";
  if (suggested?.id === selected.id) return "Yep, looks right";
  return "Use this Garmin activity";
}

export default function WorkoutActivityMatchPanel({
  workoutId,
  workoutTitle,
  onMatched,
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [matchedActivity, setMatchedActivity] = useState<CandidateActivity | null>(null);
  const [candidates, setCandidates] = useState<CandidateActivity[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchSuccess, setMatchSuccess] = useState(false);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [visibleStepIndex, setVisibleStepIndex] = useState(0);
  const [changingMatch, setChangingMatch] = useState(false);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMatchSuccess(false);
    try {
      const res = await api.get<{
        candidates: CandidateActivity[];
        matchedActivity: CandidateActivity | null;
      }>(`/workouts/${workoutId}/match-activity`);
      if (res.data?.matchedActivity) {
        setMatchedActivity(res.data.matchedActivity);
        setCandidates([]);
        setSelectedId("");
        return;
      }
      setMatchedActivity(null);
      const list = res.data?.candidates;
      setCandidates(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Could not load activities");
      setCandidates([]);
      setMatchedActivity(null);
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
      setMatchSuccess(true);
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

  const unlinkCurrentMatch = async (options?: { forChange?: boolean }) => {
    if (
      !options?.forChange &&
      !window.confirm(
        "Unlink the current Garmin activity from this workout? You can then choose a different activity."
      )
    ) {
      return;
    }
    setUnlinking(true);
    setError(null);
    try {
      await api.post(`/workouts/${workoutId}/match-activity`, { activityId: null });
      setMatchedActivity(null);
      setChangingMatch(Boolean(options?.forChange));
      await loadCandidates();
      await onMatched();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Could not unlink activity");
    } finally {
      setUnlinking(false);
    }
  };

  const deleteCandidate = async (activityId: string) => {
    if (
      !window.confirm(
        "Delete this bad GoFast activity row? This does not delete it from Garmin."
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

  const renderActivityStats = (a: CandidateActivity) => {
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
    return (
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-600">
        {a.reasonLabels?.map((label) => (
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
    );
  };

  const renderCandidate = (a: CandidateActivity, highlight?: boolean) => {
    const selected = selectedId === a.id;
    const title = activityDisplayTitle(a);
    const conflictNote = conflictMessage(a.conflict);
    const repairableConflict = isRepairableConflict(a.conflict);

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
          {renderActivityStats(a)}
          {conflictNote ? (
            <p
              className={`mt-1 text-xs ${
                a.conflict?.type === "unrelated_planned_workout"
                  ? "text-red-700"
                  : "text-gray-600"
              }`}
            >
              {conflictNote}
            </p>
          ) : null}
        </button>
        {!repairableConflict && a.conflict == null ? (
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
              Delete bad GoFast row
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const shellClass = `bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden ${
    compact ? "mb-4" : "mb-6"
  }`;

  if (loading) {
    return (
      <div
        id="match-garmin-panel"
        className={`${shellClass} p-4 flex items-center gap-2 text-sm text-gray-500`}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Looking for matching Garmin activities…
      </div>
    );
  }

  if (matchSuccess) {
    return (
      <div
        id="match-garmin-panel"
        className={`${shellClass} p-4`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Workout logged</p>
            <p className="mt-0.5 text-sm text-emerald-800">
              Matched to your Garmin run.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (matchedActivity && !changingMatch) {
    const title = activityDisplayTitle(matchedActivity);
    return (
      <div id="match-garmin-panel" className={shellClass}>
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Garmin run matched</h2>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            {renderActivityStats(matchedActivity)}
          </div>
          <p className="text-xs text-gray-600">
            This workout is already linked to a Garmin activity.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={unlinking}
              onClick={() => void unlinkCurrentMatch()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {unlinking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2Off className="h-4 w-4" />
              )}
              Unlink current match
            </button>
            <button
              type="button"
              disabled={unlinking}
              onClick={() => void unlinkCurrentMatch({ forChange: true })}
              className="inline-flex items-center rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900 hover:bg-orange-100 disabled:opacity-50"
            >
              Change activity
            </button>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div id="match-garmin-panel" className={shellClass}>
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Watch className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900 text-sm">Match your Garmin run</h2>
        </div>
        {workoutTitle?.trim() ? (
          <p className="mt-1 text-xs text-gray-600 line-clamp-2">
            For planned workout:{" "}
            <span className="font-medium text-gray-800">{workoutTitle.trim()}</span>
          </p>
        ) : null}
      </div>
      <div className="p-4 space-y-4">
        {changingMatch ? (
          <p className="text-xs text-gray-600">
            Pick a different Garmin activity for this workout.
          </p>
        ) : (
          <p className="text-xs text-gray-600 leading-relaxed">
            {compact && suggested
              ? "Pick the Garmin activity you completed for this planned workout."
              : "Pick the Garmin activity you completed. We'll match it to this planned workout."}
          </p>
        )}

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
              {confirmButtonLabel(selectedCandidate, suggested, saving)}
            </button>
          </>
        )}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
