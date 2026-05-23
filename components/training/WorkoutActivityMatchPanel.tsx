"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Watch } from "lucide-react";
import api from "@/lib/api";

type CandidateActivity = {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: string | null;
  distance: number | null;
  duration: number | null;
  paceSecPerMile: number | null;
  ingestionStatus: string;
  matchedWorkoutId: string | null;
  matchedWorkoutTitle: string | null;
  reasonLabels: string[];
};

interface Props {
  workoutId: string;
  onMatched: () => void | Promise<void>;
}

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

export default function WorkoutActivityMatchPanel({ workoutId, onMatched }: Props) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CandidateActivity[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        candidates: CandidateActivity[];
        matchedActivity: CandidateActivity | null;
      }>(`/workouts/${workoutId}/match-activity`);
      const list = res.data?.candidates;
      setCandidates(Array.isArray(list) ? list : []);
      if (res.data?.matchedActivity) {
        setSelectedId("");
      }
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
  const rest = useMemo(() => (candidates.length > 1 ? candidates.slice(1) : []), [candidates]);

  useEffect(() => {
    if (suggested && !selectedId) {
      setSelectedId(suggested.id);
    }
  }, [suggested, selectedId]);

  const confirmMatch = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/workouts/${workoutId}/match-activity`, {
        activityId: selectedId,
      });
      await onMatched();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Could not match activity");
    } finally {
      setSaving(false);
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

    return (
      <button
        key={a.id}
        type="button"
        onClick={() => setSelectedId(a.id)}
        className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
          selected
            ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500"
            : highlight
              ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <p className="text-sm font-semibold text-gray-900 line-clamp-2">{title}</p>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-600">
          {a.reasonLabels.map((label) => (
            <span
              key={label}
              className={`rounded px-1.5 py-0.5 font-medium ${
                label === "Title match"
                  ? "bg-emerald-100 text-emerald-900"
                  : label === "Already linked"
                    ? "bg-amber-100 text-amber-900"
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
        {a.matchedWorkoutId && a.matchedWorkoutTitle ? (
          <p className="mt-1 text-xs text-amber-800">
            Linked to: {a.matchedWorkoutTitle}
          </p>
        ) : null}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Looking for matching Garmin activities…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2">
        <Watch className="h-4 w-4 text-gray-400" />
        <h2 className="font-semibold text-gray-900 text-sm">Match your Garmin run</h2>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          We found activities near this workout&apos;s date. Pick the run you completed and
          confirm to log results and analysis.
        </p>

        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500">
            No nearby running activities found. Sync Garmin from Training settings, then refresh
            this page.
          </p>
        ) : (
          <>
            {suggested ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Suggested match
                </p>
                {renderCandidate(suggested, true)}
              </div>
            ) : null}

            {rest.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Other nearby activities</p>
                <div className="space-y-2 max-h-[min(18rem,40vh)] overflow-y-auto pr-1">
                  {rest.map((a) => renderCandidate(a))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={!selectedId || saving}
              onClick={() => void confirmMatch()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {saving ? "Matching…" : "Yes, match this activity"}
            </button>
          </>
        )}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
