"use client";

import { useState } from "react";
import IntakeModePicker, { type IntakeMode } from "@/components/runmanage/intake/IntakeModePicker";
import {
  CLUB_WORKOUT_TYPES,
  type ClubWorkoutType,
} from "./TrackWorkoutBuilder";
import {
  DEFAULT_PACE_OPTION,
  isTrackRun,
  nullRouteFieldsForTrackRun,
  PACE_OPTIONS,
  RUN_TYPE_LABELS,
  RUN_TYPE_VALUES,
} from "@/lib/runTypes";
import TrackWorkoutBuilder from "./TrackWorkoutBuilder";
import type { RunInstanceWizardContext, RunInstanceWizardValues } from "./shared";

const WORKOUT_KIND_LABELS: Record<ClubWorkoutType, string> = {
  Easy: "Easy — miles & pace",
  Tempo: "Tempo — structured",
  Intervals: "Intervals — structured",
  LongRun: "Long run — structured",
  Race: "Race effort — structured",
};

function resolveWorkoutKind(values: RunInstanceWizardValues, isTrack: boolean): ClubWorkoutType {
  const t = values.clubWorkoutType?.trim();
  if (t && (CLUB_WORKOUT_TYPES as readonly string[]).includes(t)) {
    return t as ClubWorkoutType;
  }
  if (isTrack) return "Intervals";
  return "Easy";
}

function isStructuredWorkoutKind(kind: ClubWorkoutType): boolean {
  return kind !== "Easy";
}

type Props = {
  values: RunInstanceWizardValues;
  onChange: (partial: Partial<RunInstanceWizardValues>) => void;
  onReplace: (next: RunInstanceWizardValues) => void;
  context: RunInstanceWizardContext;
  onError?: (msg: string | null) => void;
};

export default function AthleteHostedWorkoutStep({
  values,
  onChange,
  onReplace,
  context,
  onError,
}: Props) {
  const isTrack = isTrackRun(values.runType);
  const workoutKind = resolveWorkoutKind(values, isTrack);
  const structured = isTrack || isStructuredWorkoutKind(workoutKind);

  const [structMode, setStructMode] = useState<IntakeMode | null>(() =>
    values.plannedWorkoutId.trim() ? "manual" : null,
  );

  const handleRunTypeChange = (nextRunType: string) => {
    if (isTrackRun(nextRunType)) {
      const nulls = nullRouteFieldsForTrackRun(nextRunType);
      onReplace({
        ...values,
        runType: nextRunType,
        clubWorkoutType: values.clubWorkoutType === "Easy" ? "Intervals" : values.clubWorkoutType,
        stravaMapUrl: nulls ? "" : values.stravaMapUrl,
        mapImageUrl: nulls ? "" : values.mapImageUrl,
        routePhotos: nulls ? [] : values.routePhotos,
        routeNeighborhood: nulls ? "" : values.routeNeighborhood,
        routeId: nulls ? "" : values.routeId,
        linkedRouteName: nulls ? "" : values.linkedRouteName,
        directionsText: nulls ? "" : values.directionsText,
        routeDescription: nulls ? "" : values.routeDescription,
      });
      return;
    }
    onChange({ runType: nextRunType });
  };

  const handleWorkoutKindChange = (kind: ClubWorkoutType) => {
    if (kind === "Easy") {
      setStructMode(null);
      onChange({
        clubWorkoutType: "Easy",
        plannedWorkoutId: "",
        attachedWorkoutTitle: "",
        trackWorkoutDescription: "",
      });
      onError?.(null);
      return;
    }
    onChange({
      clubWorkoutType: kind,
      plannedWorkoutId: "",
      attachedWorkoutTitle: "",
    });
    setStructMode(null);
    onError?.(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">Where you&apos;re running</label>
        <select
          value={values.runType}
          onChange={(e) => handleRunTypeChange(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Road / park / trail</option>
          {RUN_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {RUN_TYPE_LABELS[v]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">Track skips the route step.</p>
      </div>

      {!isTrack ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Workout kind</label>
          <select
            value={workoutKind}
            onChange={(e) => handleWorkoutKindChange(e.target.value as ClubWorkoutType)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {CLUB_WORKOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {WORKOUT_KIND_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!structured ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Distance (miles)</label>
              <input
                type="text"
                inputMode="decimal"
                value={values.totalMiles}
                onChange={(e) => onChange({ totalMiles: e.target.value })}
                placeholder="e.g. 4.7"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Pace</label>
              <select
                value={values.pace || DEFAULT_PACE_OPTION}
                onChange={(e) => onChange({ pace: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select pace…</option>
                {PACE_OPTIONS.map((pace) => (
                  <option key={pace} value={pace}>
                    {pace}
                  </option>
                ))}
                {values.pace &&
                  !PACE_OPTIONS.includes(values.pace as (typeof PACE_OPTIONS)[number]) && (
                    <option value={values.pace}>{values.pace}</option>
                  )}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
          <IntakeModePicker
            mode={structMode}
            onChange={setStructMode}
            modes={["paste", "manual"]}
            descriptions={{
              paste: "Paste workout text, then review segments.",
              manual: "Add segments yourself.",
            }}
          />
          {structMode ? (
            <TrackWorkoutBuilder
              clubId=""
              cityRunId={context.cityRunId}
              runDate={values.date}
              pendingSave
              athleteStructured
              controlledBuildMode={structMode === "paste" ? "ai" : "manual"}
              values={{
                trackWorkoutDescription: values.trackWorkoutDescription,
                plannedWorkoutId: values.plannedWorkoutId,
                attachedWorkoutTitle: values.attachedWorkoutTitle,
                clubWorkoutType: workoutKind === "Easy" ? "Intervals" : workoutKind,
              }}
              initialSegments={context.plannedWorkoutSegments ?? null}
              initialWorkoutTitle={context.plannedWorkoutTitle ?? null}
              initialWorkoutType={context.plannedWorkoutType ?? null}
              onChange={(partial) => onChange(partial)}
              onError={onError}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
