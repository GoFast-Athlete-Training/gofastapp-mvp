"use client";

import Link from "next/link";

type CreateFeedbackKind = "goals" | "dates" | "distanceMismatch" | "incompletePreset" | "generic";

type ActivePlanLite = {
  id: string;
  name?: string;
};

type Props = {
  planName: string;
  onPlanNameChange: (v: string) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  paceMin: string;
  paceSec: string;
  onPaceMinChange: (v: string) => void;
  onPaceSecChange: (v: string) => void;
  currentWeekNumber: number;
  currentWeekPhaseLabel: string;
  formError: string | null;
  replaceBlockPlan: ActivePlanLite | null;
  createFeedback: CreateFeedbackKind | null;
  createFeedbackMessage: string | null;
  creating: boolean;
  onBack: () => void;
  onOpenExistingPlan: (planId: string) => void;
  onLoadThisWeek: () => void;
  onLoadFullPlan: () => void;
  onForceReplace: (redirect: "week" | "plan") => void;
  onDismissFeedback: () => void;
  onRefreshGoals: () => void;
};

export function WeekByWeekSetupPanel({
  planName,
  onPlanNameChange,
  startDate,
  onStartDateChange,
  paceMin,
  paceSec,
  onPaceMinChange,
  onPaceSecChange,
  currentWeekNumber,
  currentWeekPhaseLabel,
  formError,
  replaceBlockPlan,
  createFeedback,
  createFeedbackMessage,
  creating,
  onBack,
  onOpenExistingPlan,
  onLoadThisWeek,
  onLoadFullPlan,
  onForceReplace,
  onDismissFeedback,
  onRefreshGoals,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-gray-800">
        <p className="font-medium text-gray-900">Load your schedule</p>
        <p className="mt-2 leading-relaxed text-gray-700">
          We open a calendar shell with race day stamped. You load workouts as JSON on the plan —
          not a generated preset. Pick one week or upload the full multi-week template.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 text-sm font-medium text-orange-600 hover:text-orange-800"
        >
          ← Back
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800">Plan name</label>
          <input
            type="text"
            maxLength={120}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
            value={planName}
            onChange={(e) => onPlanNameChange(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800">Plan start date</label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Current 5K pace (for workout zones)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={2}
              max={30}
              placeholder="min"
              className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
              value={paceMin}
              onChange={(e) => onPaceMinChange(e.target.value)}
            />
            <span className="text-gray-500">:</span>
            <input
              type="number"
              min={0}
              max={59}
              placeholder="sec"
              className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
              value={paceSec}
              onChange={(e) => onPaceSecChange(e.target.value)}
            />
            <span className="text-sm text-gray-600">min / mile</span>
          </div>
        </div>
      </div>

      {formError ? <p className="text-sm text-amber-800">{formError}</p> : null}

      {replaceBlockPlan ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="mb-2 font-medium">You already have an active plan for this goal</p>
          <p className="mb-3 text-amber-900/90">
            Open it to keep loading weeks, or start fresh — your current plan goes to history.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => onOpenExistingPlan(replaceBlockPlan.id)}
              className="inline-flex justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Open existing plan
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => onForceReplace("week")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Start fresh — load this week
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => onForceReplace("plan")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Start fresh — full plan CSV
            </button>
          </div>
        </div>
      ) : null}

      {createFeedback === "goals" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="mb-2 font-medium">Update your goal first</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/goals"
              className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Open Goals
            </Link>
            <button
              type="button"
              onClick={onRefreshGoals}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium"
            >
              Refresh goal list
            </button>
          </div>
        </div>
      ) : null}

      {createFeedback === "dates" ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <p className="font-medium">Check your start date</p>
          <p className="mt-1 text-sky-900/90">Plan start must be before race day.</p>
        </div>
      ) : null}

      {createFeedback === "generic" ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="mb-2">Could not open your plan shell. Try again in a moment.</p>
          <button type="button" onClick={onDismissFeedback} className="text-sm font-medium underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {createFeedbackMessage && createFeedback === "generic" ? (
        <p className="text-xs text-gray-600">{createFeedbackMessage}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={creating}
          onClick={onLoadThisWeek}
          className="rounded-xl border-2 border-orange-200 bg-white p-4 text-left hover:border-orange-400 hover:bg-orange-50/40 disabled:opacity-60"
        >
          <p className="font-semibold text-gray-900">Just this week</p>
          <p className="mt-1 text-sm text-gray-600">
            Week {currentWeekNumber} · {currentWeekPhaseLabel} phase — paste or week CSV on the
            next screen.
          </p>
        </button>
        <button
          type="button"
          disabled={creating}
          onClick={onLoadFullPlan}
          className="rounded-xl border-2 border-sky-200 bg-white p-4 text-left hover:border-sky-400 hover:bg-sky-50/40 disabled:opacity-60"
        >
          <p className="font-semibold text-gray-900">Full multi-week plan</p>
          <p className="mt-1 text-sm text-gray-600">
            Download the template with a Week column, fill all training days, upload once.
          </p>
        </button>
      </div>
    </div>
  );
}
