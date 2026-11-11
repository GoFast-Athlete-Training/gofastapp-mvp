"use client";

import { useState } from "react";
import RunManageRouteAttachPanel from "@/components/runmanage/runInstanceWizard/RunManageRouteAttachPanel";
import TrackWorkoutBuilder from "./TrackWorkoutBuilder";
import { generateCitySlugFromParts } from "@/lib/utils/parseAddress";
import type { RunInstanceWizardContext, RunInstanceWizardValues } from "./shared";

type Props = {
  values: RunInstanceWizardValues;
  patch: (partial: Partial<RunInstanceWizardValues>) => void;
  context: RunInstanceWizardContext;
  onErrorChange?: (msg: string | null) => void;
};

export default function RunManageStaffOptionalRunActions({
  values,
  patch,
  context,
  onErrorChange,
}: Props) {
  const [showAttach, setShowAttach] = useState(Boolean(values.routeId?.trim()));
  const [showWorkout, setShowWorkout] = useState(
    Boolean(values.plannedWorkoutId?.trim() || values.trackWorkoutDescription?.trim())
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
        <p className="text-sm font-semibold text-gray-900">Route on this run</p>
        <p className="mt-1 text-xs text-gray-600">
          Strava link and notes save on the city run. Attach a catalog route or build one when you want
          a shared <code className="text-[11px]">routes</code> row.
        </p>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-800">Strava route link</span>
            <input
              type="url"
              value={values.stravaMapUrl}
              onChange={(e) => patch({ stravaMapUrl: e.target.value })}
              placeholder="https://www.strava.com/routes/…"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-800">Route notes (this run)</span>
            <textarea
              value={values.routeNotes}
              onChange={(e) => patch({ routeNotes: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-800">Turn-by-turn / directions</span>
            <textarea
              value={values.directionsText}
              onChange={(e) => patch({ directionsText: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAttach((v) => !v)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
          >
            {showAttach ? "Hide attach route" : "Attach a route"}
          </button>
          <button
            type="button"
            onClick={() => setShowWorkout((v) => !v)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
          >
            {showWorkout ? "Hide workout" : "Workout"}
          </button>
        </div>
        {showAttach ? (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <RunManageRouteAttachPanel
              values={values}
              patch={patch}
              cityRunId={context.cityRunId}
              citySlug={generateCitySlugFromParts(values.meetUpCity, values.meetUpState) || null}
              onError={onErrorChange}
            />
          </div>
        ) : null}
      </div>

      {showWorkout ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
          <p className="text-sm font-semibold text-gray-900">Workout (optional)</p>
          <TrackWorkoutBuilder
            clubId={context.clubId?.trim() || ""}
            cityRunId={context.cityRunId}
            runDate={values.date}
            values={{
              trackWorkoutDescription: values.trackWorkoutDescription,
              plannedWorkoutId: values.plannedWorkoutId,
              attachedWorkoutTitle: values.attachedWorkoutTitle,
              clubWorkoutType: values.clubWorkoutType,
            }}
            initialSegments={context.plannedWorkoutSegments ?? null}
            initialWorkoutTitle={context.plannedWorkoutTitle ?? null}
            initialWorkoutType={context.plannedWorkoutType ?? null}
            onChange={(partial) => patch(partial)}
            onError={onErrorChange}
          />
        </div>
      ) : null}
    </div>
  );
}
