"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import api from "@/lib/api";
import { PaceMiSplitEditor } from "@/components/workout/PaceMiSplitEditor";
import { inferSegmentKind } from "@/lib/group-workout-segment-editor";
import {
  editablePlannedSegmentsToApiPayload,
  plannedSegmentsToEditableState,
  type EditablePlannedSegment,
  type PlannedWorkoutSegment,
} from "@/lib/training/planned-workout-segment-editable";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";

export type DayPlanPaceSplitsPanelHandle = {
  saveIfDirty: () => Promise<boolean>;
};

type Props = {
  workoutId: string;
  workoutType: string;
  segments: PlannedWorkoutSegment[];
  profileFiveKPace: string | null;
  onSaved: () => void | Promise<void>;
};

function cardHeaderLabel(title: string): string {
  const kind = inferSegmentKind(title);
  if (kind === "warmup") return "Warmup";
  if (kind === "cooldown") return "Cooldown";
  return "Work";
}

function cardHeaderClass(title: string): string {
  const kind = inferSegmentKind(title);
  if (kind === "warmup" || kind === "cooldown") return "bg-gray-500 text-white";
  return "bg-orange-500 text-white";
}

export const DayPlanPaceSplitsPanel = forwardRef<DayPlanPaceSplitsPanelHandle, Props>(
  function DayPlanPaceSplitsPanel(
    { workoutId, workoutType, segments, profileFiveKPace, onSaved },
    ref
  ) {
    const fiveKSec = useMemo(() => {
      const raw = profileFiveKPace?.trim();
      if (!raw) return null;
      try {
        const sec = parsePaceToSecondsPerMile(raw);
        return Number.isFinite(sec) && sec > 0 ? sec : null;
      } catch {
        return null;
      }
    }, [profileFiveKPace]);

    const [editSegments, setEditSegments] = useState<EditablePlannedSegment[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveOk, setSaveOk] = useState<string | null>(null);
    const baselineRef = useRef("");

    useEffect(() => {
      const next = plannedSegmentsToEditableState(segments, workoutType, fiveKSec);
      setEditSegments(next);
      baselineRef.current = JSON.stringify(next);
      setSaveError(null);
      setSaveOk(null);
    }, [segments, workoutType, fiveKSec]);

    const isDirty = useMemo(
      () => JSON.stringify(editSegments) !== baselineRef.current,
      [editSegments]
    );

    const saveSegments = useCallback(async (): Promise<boolean> => {
      if (editSegments.length === 0) return true;
      if (!isDirty) return true;
      setSaving(true);
      setSaveError(null);
      setSaveOk(null);
      try {
        const payload = editablePlannedSegmentsToApiPayload(editSegments);
        await api.put(`/workouts/${workoutId}/segments`, payload);
        baselineRef.current = JSON.stringify(editSegments);
        setSaveOk("Pace splits saved.");
        await onSaved();
        return true;
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { error?: string } }; message?: string };
        setSaveError(ax.response?.data?.error || ax.message || "Could not save pace splits");
        return false;
      } finally {
        setSaving(false);
      }
    }, [editSegments, isDirty, onSaved, workoutId]);

    useImperativeHandle(ref, () => ({ saveIfDirty: saveSegments }), [saveSegments]);

    if (editSegments.length === 0) {
      return (
        <p className="text-sm text-gray-600">No structured steps to edit on this workout.</p>
      );
    }

    return (
      <div className="space-y-3">
        {profileFiveKPace ? (
          <p className="text-xs text-gray-600 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            Pace band from your profile 5K:{" "}
            <span className="font-semibold text-gray-900">{profileFiveKPace}</span>/mi
          </p>
        ) : null}
        {editSegments.map((segment, index) => {
          const kind = inferSegmentKind(segment.title);
          const isWork = kind === "work";
          return (
            <div
              key={segment.clientKey}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${cardHeaderClass(segment.title)}`}
              >
                {cardHeaderLabel(segment.title)}
              </div>
              <div className="p-4 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    {segment.durationType === "TIME" ? "Duration (minutes)" : "Distance"}
                    {segment.durationType === "DISTANCE" ? (
                      <span className="ml-2 rounded bg-orange-50 px-2 py-0.5 text-xs font-semibold normal-case text-orange-900">
                        mi
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={segment.durationValue}
                    onChange={(e) =>
                      setEditSegments((prev) =>
                        prev.map((s) =>
                          s.clientKey === segment.clientKey
                            ? { ...s, durationValue: e.target.value }
                            : s
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                {isWork ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                        Pace low
                        {profileFiveKPace ? (
                          <span className="normal-case font-normal text-gray-400"> (from 5K)</span>
                        ) : null}
                      </span>
                      <PaceMiSplitEditor
                        minValue={segment.paceLowMin}
                        secValue={segment.paceLowSec}
                        onMinChange={(v) =>
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey ? { ...s, paceLowMin: v } : s
                            )
                          )
                        }
                        onSecChange={(v) =>
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey ? { ...s, paceLowSec: v } : s
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                        Pace high
                        {profileFiveKPace ? (
                          <span className="normal-case font-normal text-gray-400"> (from 5K)</span>
                        ) : null}
                      </span>
                      <PaceMiSplitEditor
                        minValue={segment.paceHighMin}
                        secValue={segment.paceHighSec}
                        onMinChange={(v) =>
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey ? { ...s, paceHighMin: v } : s
                            )
                          )
                        }
                        onSecChange={(v) =>
                          setEditSegments((prev) =>
                            prev.map((s) =>
                              s.clientKey === segment.clientKey ? { ...s, paceHighSec: v } : s
                            )
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}
                {index < editSegments.length - 1 ? null : null}
              </div>
            </div>
          );
        })}
        {saveError ? (
          <p className="text-sm text-red-600" role="alert">
            {saveError}
          </p>
        ) : null}
        {saveOk ? (
          <p className="text-sm text-emerald-800" role="status">
            {saveOk}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void saveSegments()}
          disabled={saving || !isDirty}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {saving ? "Saving…" : isDirty ? "Save pace splits" : "Pace splits up to date"}
        </button>
      </div>
    );
  }
);
