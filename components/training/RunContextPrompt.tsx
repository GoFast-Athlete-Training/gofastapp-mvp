"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import {
  RUN_CONTEXT_OPTIONS,
  type RunContextOption,
} from "@/lib/training/coach-read-display";
import type { RunAnalysisJsonV1 } from "@/lib/training/run-analysis-types";

type RunContextPromptProps = {
  workoutId: string;
  initialTags?: string[] | null;
  initialNote?: string | null;
  hasCoachFeedback?: boolean;
  coachFeedbackBlocked?: boolean;
  coachFeedbackBlockedReason?: string;
  className?: string;
  onFeedbackReady?: (analysis: RunAnalysisJsonV1) => void | Promise<void>;
};

export default function RunContextPrompt({
  workoutId,
  initialTags,
  initialNote,
  hasCoachFeedback = false,
  coachFeedbackBlocked = false,
  coachFeedbackBlockedReason,
  className = "",
  onFeedbackReady,
}: RunContextPromptProps) {
  const allowed = useMemo(() => new Set<string>(RUN_CONTEXT_OPTIONS), []);
  const [selected, setSelected] = useState<Set<RunContextOption>>(() => {
    const tags = (initialTags ?? []).filter((t): t is RunContextOption =>
      allowed.has(t)
    );
    return new Set(tags);
  });
  const [note, setNote] = useState(initialNote?.trim() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(option: RunContextOption) {
    if (hasCoachFeedback) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }

  const hasInput = selected.size > 0 || note.trim().length > 0;
  const feedbackDisabled = coachFeedbackBlocked && !hasCoachFeedback;

  async function requestCoachFeedback() {
    if (!hasInput || loading || hasCoachFeedback || feedbackDisabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{
        analysisJson?: RunAnalysisJsonV1;
        error?: string;
      }>(`/workouts/${workoutId}/coach-feedback`, {
        contextTags: Array.from(selected),
        contextNote: note.trim() || null,
      });
      const analysis = res.data?.analysisJson;
      if (!analysis?.narrative) {
        throw new Error("Coach feedback was not returned");
      }
      await onFeedbackReady?.(analysis);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Could not get coach feedback");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white/90 p-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
        Run context
      </p>
      <p className="mt-1 text-sm text-gray-600">
        {hasCoachFeedback
          ? "Your context was used for the coach read below."
          : "What shaped this run? Add context, then get coach feedback."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {RUN_CONTEXT_OPTIONS.map((option) => {
          const active = selected.has(option);
          return (
            <button
              key={option}
              type="button"
              disabled={hasCoachFeedback || loading}
              onClick={() => toggle(option)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                active
                  ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                  : "bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Add note</span>
        <textarea
          value={note}
          disabled={hasCoachFeedback || loading}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Add note…"
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300 disabled:bg-gray-50"
        />
      </label>
      {!hasCoachFeedback && !feedbackDisabled ? (
        <button
          type="button"
          disabled={!hasInput || loading}
          onClick={() => void requestCoachFeedback()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Getting coach feedback…
            </>
          ) : (
            "Get coach feedback"
          )}
        </button>
      ) : null}
      {feedbackDisabled ? (
        <p className="mt-4 text-sm text-amber-800">
          {coachFeedbackBlockedReason ??
            "Coach target feedback is unavailable until Garmin lap detail syncs."}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
