"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/lib/firebase";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";
import { displayWorkoutListTitle } from "@/lib/training/workout-display-title";
import { fetchTrainingWorkoutDetail, type PlanDayCard } from "@/lib/training/fetch-plan-week-client";

type PreviewSegment = {
  id: string;
  stepOrder: number;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  repeatCount?: number | null;
  targets?: Array<{
    type: string;
    valueLow?: number;
    valueHigh?: number;
    value?: number;
  }>;
};

type PreviewWorkout = {
  title: string;
  workoutType: string;
  description: string | null;
  estimatedDistanceInMeters?: number | null;
  segments: PreviewSegment[];
};

function pickWorkoutPayload(raw: unknown): PreviewWorkout | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  const title = typeof w.title === "string" ? w.title : "";
  const workoutType = typeof w.workoutType === "string" ? w.workoutType : "";
  const description = typeof w.description === "string" ? w.description : null;
  const estimatedDistanceInMeters =
    typeof w.estimatedDistanceInMeters === "number" ? w.estimatedDistanceInMeters : null;
  const segsRaw = w.segments;
  const segments: PreviewSegment[] = [];
  if (Array.isArray(segsRaw)) {
    for (const s of segsRaw) {
      if (!s || typeof s !== "object") continue;
      const o = s as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : String(o.id ?? "");
      const stepOrder = typeof o.stepOrder === "number" ? o.stepOrder : Number(o.stepOrder);
      const titleSeg = typeof o.title === "string" ? o.title : "";
      const durationType = o.durationType === "TIME" ? "TIME" : "DISTANCE";
      const durationValue =
        typeof o.durationValue === "number" ? o.durationValue : Number(o.durationValue);
      if (!id || !Number.isFinite(stepOrder) || !titleSeg || !Number.isFinite(durationValue)) continue;
      const repeatCount =
        o.repeatCount == null
          ? undefined
          : typeof o.repeatCount === "number"
            ? o.repeatCount
            : Number(o.repeatCount);
      const targets = Array.isArray(o.targets) ? (o.targets as PreviewSegment["targets"]) : undefined;
      segments.push({
        id,
        stepOrder,
        title: titleSeg,
        durationType,
        durationValue,
        repeatCount:
          repeatCount != null && Number.isFinite(repeatCount) ? repeatCount : undefined,
        targets,
      });
    }
    segments.sort((a, b) => a.stepOrder - b.stepOrder);
  }
  return { title, workoutType, description, estimatedDistanceInMeters, segments };
}

function metersToMiDisplay(m: number | null | undefined): string | null {
  if (m == null || !Number.isFinite(m)) return null;
  const mi = m / 1609.34;
  if (mi >= 10) return `${Math.round(mi)} mi`;
  if (mi >= 1) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi * 5280)} ft`;
}

export type PlanPreviewDayModalProps = {
  open: boolean;
  onClose: () => void;
  workoutId: string;
  planDay: PlanDayCard;
  weekNumber: number;
  totalWeeks: number;
  planName?: string | null;
  onDoThisWorkout: (workoutId: string) => void;
  onGoToPrevDay?: () => void | Promise<void>;
  onGoToNextDay?: () => void | Promise<void>;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
};

export default function PlanPreviewDayModal({
  open,
  onClose,
  workoutId,
  planDay,
  weekNumber,
  totalWeeks,
  planName,
  onDoThisWorkout,
  onGoToPrevDay,
  onGoToNextDay,
  prevDisabled,
  nextDisabled,
}: PlanPreviewDayModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<PreviewWorkout | null>(null);

  const load = useCallback(async () => {
    if (!open || !workoutId) return;
    setLoading(true);
    setError(null);
    setWorkout(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Sign in required");
      const token = await u.getIdToken();
      const { workout: raw } = await fetchTrainingWorkoutDetail(workoutId, token);
      const parsed = pickWorkoutPayload(raw);
      setWorkout(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workout");
    } finally {
      setLoading(false);
    }
  }, [open, workoutId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const plannedDateLabel = planDay.date
    ? formatPlanDateDisplay(planDay.date, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "—";

  const scheduleMi = metersToMiDisplay(planDay.estimatedDistanceInMeters);
  const title =
    workout?.title?.trim() || displayWorkoutListTitle(planDay);
  const typeLabel = workout?.workoutType || planDay.workoutType;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-preview-day-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Planned in your schedule
            </p>
            {planName?.trim() ? (
              <p className="mt-0.5 text-xs text-gray-600 truncate">{planName}</p>
            ) : null}
            <h2 id="plan-preview-day-title" className="mt-1 text-lg font-semibold text-gray-900 leading-snug">
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Week {weekNumber} of {totalWeeks} · {plannedDateLabel}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {typeLabel}
              {scheduleMi ? ` · ~${scheduleMi} planned` : null}
              {" · "}
              <span className="font-medium text-gray-600">{planDay.phase}</span> phase
            </p>
            {workout?.description?.trim() ? (
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{workout.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-4">
          {loading && <p className="text-sm text-gray-500">Loading segments…</p>}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && workout && workout.segments.length === 0 && (
            <p className="text-sm text-gray-600">
              No structured steps yet for this workout type. You can still open the full workout
              to set up your run or see more detail.
            </p>
          )}
          {!loading && !error && workout && workout.segments.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                Structure
              </p>
              <ol className="space-y-2">
                {workout.segments.map((segment) => (
                  <li
                    key={segment.id}
                    className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm"
                  >
                    <div className="font-medium text-gray-900">
                      {segment.stepOrder}. {segment.title}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600">
                      {segment.repeatCount != null && segment.repeatCount > 1 ? (
                        <span>Repeat {segment.repeatCount}× · </span>
                      ) : null}
                      {segment.durationType === "DISTANCE"
                        ? `${segment.durationValue} miles`
                        : `${segment.durationValue} minutes`}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="text-xs text-gray-500 leading-relaxed">
            Browsing your plan: use the buttons below when you&apos;re ready to set up this run on
            your watch or log it — that opens the full workout screen.
          </p>
        </div>

        <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/60">
          <div className="flex gap-2">
            {onGoToPrevDay && (
              <button
                type="button"
                disabled={prevDisabled || loading}
                onClick={() => void onGoToPrevDay()}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                Previous day
              </button>
            )}
            {onGoToNextDay && (
              <button
                type="button"
                disabled={nextDisabled || loading}
                onClick={() => void onGoToNextDay()}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-40"
              >
                Next day
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDoThisWorkout(workoutId)}
            disabled={loading || !!error}
            className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            Do this workout
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to plan
          </button>
        </div>
      </div>
    </div>
  );
}
