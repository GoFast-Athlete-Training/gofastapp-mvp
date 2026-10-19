"use client";

import { useState } from "react";
import type { PlanIngestScope } from "@/lib/training/plan-ingest-contract";
import type { PlanDayCard } from "@/lib/training/fetch-plan-week-client";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";
import PlanIngestPanel from "@/components/training/PlanIngestPanel";

export type IngestScopeChoice = "plan" | "week" | "workout";

type Props = {
  planId: string;
  weekNumber: number;
  weekDays: PlanDayCard[];
  getToken: () => Promise<string>;
  /** Which scope options to show. */
  allowedScopes: IngestScopeChoice[];
  onCommitted: () => void;
  onClose: () => void;
};

function initialIngestChoice(allowedScopes: IngestScopeChoice[]): IngestScopeChoice | null {
  if (allowedScopes.length === 1) return allowedScopes[0] ?? null;
  return null;
}

export function TrainingHubIngestScopeFlow({
  planId,
  weekNumber,
  weekDays,
  getToken,
  allowedScopes,
  onCommitted,
  onClose,
}: Props) {
  const [choice, setChoice] = useState<IngestScopeChoice | null>(() =>
    initialIngestChoice(allowedScopes)
  );
  const [workoutDateKey, setWorkoutDateKey] = useState<string | null>(null);
  const singleScope = allowedScopes.length === 1;

  const activeScope: PlanIngestScope | null =
    choice === "plan"
      ? "plan"
      : choice === "week"
        ? "week"
        : choice === "workout" && workoutDateKey
          ? "workout"
          : null;

  if (activeScope === "plan") {
    return (
      <div className="space-y-3">
        <ScopeHeader
          onBack={singleScope ? onClose : () => setChoice(null)}
          onClose={onClose}
          label="Replace with my plan"
          showBack={!singleScope}
        />
        <PlanIngestPanel
          planId={planId}
          scope="plan"
          getToken={getToken}
          title="Replace with my plan"
          description="Future weeks only — completed weeks stay as-is."
          defaultOpen
          onCommitted={onCommitted}
        />
      </div>
    );
  }

  if (activeScope === "week") {
    return (
      <div className="space-y-3">
        <ScopeHeader
          onBack={singleScope ? onClose : () => setChoice(null)}
          onClose={onClose}
          label="Replace this week"
          showBack={!singleScope}
        />
        <PlanIngestPanel
          planId={planId}
          scope="week"
          weekNumber={weekNumber}
          getToken={getToken}
          title="Paste this week"
          description="Replace the current calendar week. One line per run day."
          defaultOpen
          onCommitted={onCommitted}
        />
      </div>
    );
  }

  if (activeScope === "workout" && workoutDateKey) {
    return (
      <div className="space-y-3">
        <ScopeHeader onBack={() => setWorkoutDateKey(null)} onClose={onClose} label="Change one day" />
        <PlanIngestPanel
          planId={planId}
          scope="workout"
          dateKey={workoutDateKey}
          getToken={getToken}
          title="Paste this workout"
          description="Replace the session on this day."
          defaultOpen
          onCommitted={onCommitted}
        />
      </div>
    );
  }

  if (choice === "workout" && !workoutDateKey) {
    return (
      <div className="space-y-3">
        <ScopeHeader onBack={() => setChoice(null)} onClose={onClose} label="Pick a day" />
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {weekDays.map((d) => (
            <li key={d.dateKey}>
              <button
                type="button"
                onClick={() => setWorkoutDateKey(d.dateKey)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {formatPlanDateDisplay(d.dateKey || String(d.date), {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                <span className="text-gray-500"> · {d.title || d.workoutType}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">What are you changing?</p>
      <div className="flex flex-col gap-2">
        {allowedScopes.includes("plan") ? (
          <button
            type="button"
            onClick={() => setChoice("plan")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            The whole plan
          </button>
        ) : null}
        {allowedScopes.includes("week") ? (
          <button
            type="button"
            onClick={() => setChoice("week")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            This week
          </button>
        ) : null}
        {allowedScopes.includes("workout") ? (
          <button
            type="button"
            onClick={() => setChoice("workout")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            One day
          </button>
        ) : null}
      </div>
      <button type="button" onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-900">
        Cancel
      </button>
    </div>
  );
}

function ScopeHeader({
  label,
  onBack,
  onClose,
  showBack = true,
}: {
  label: string;
  onBack: () => void;
  onClose: () => void;
  showBack?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      {showBack ? (
        <button type="button" onClick={onBack} className="text-sm font-semibold text-sky-800 hover:underline">
          ← Back
        </button>
      ) : (
        <span className="w-12" aria-hidden />
      )}
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
        Close
      </button>
    </div>
  );
}
