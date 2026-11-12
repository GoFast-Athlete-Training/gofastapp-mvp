"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import api from "@/lib/api";
import { PaceMiSplitEditor } from "@/components/workout/PaceMiSplitEditor";
import {
  type PlannedWorkoutSegment,
} from "@/lib/training/planned-workout-segment-editable";
import {
  dayPaceEditorKindHeaderClass,
  dayPaceEditorKindLabel,
  formatTotalMilesFromCollapsedEditor,
  plannedSegmentsToCollapsedDayPaceState,
  saveCollapsedDayPaceSegments,
  type DayPaceCollapsedSegment,
} from "@/lib/training/day-plan-pace-splits-editor";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import { secPerMileToSplitStrings } from "@/lib/workout/pace-mi-split";
import { shiftPaceBandSecPerMile } from "@/lib/training/workout-pace-offset";

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

function parseCardPaceSecPerMile(card: DayPaceCollapsedSegment): {
  low: number | null;
  high: number | null;
} {
  const lowMin = parseInt(card.paceLowMin || "0", 10);
  const lowSec = parseInt(card.paceLowSec || "0", 10);
  const highMin = parseInt(card.paceHighMin || "0", 10);
  const highSec = parseInt(card.paceHighSec || "0", 10);
  const hasLow = card.paceLowMin.trim() !== "" || card.paceLowSec.trim() !== "";
  const hasHigh = card.paceHighMin.trim() !== "" || card.paceHighSec.trim() !== "";
  const low = hasLow ? lowMin * 60 + lowSec : null;
  const high = hasHigh ? highMin * 60 + highSec : hasLow ? low : null;
  if (low == null || !Number.isFinite(low)) return { low: null, high: null };
  return { low, high: high != null && Number.isFinite(high) ? high : low };
}

function applyPaceBandToCard(
  card: DayPaceCollapsedSegment,
  low: number,
  high: number
): DayPaceCollapsedSegment {
  const lo = secPerMileToSplitStrings(low);
  const hi = secPerMileToSplitStrings(high);
  return {
    ...card,
    paceLowMin: lo.min,
    paceLowSec: lo.sec,
    paceHighMin: hi.min,
    paceHighSec: hi.sec,
  };
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

    const originalFlatRef = useRef<PlannedWorkoutSegment[]>([]);
    const [editSegments, setEditSegments] = useState<DayPaceCollapsedSegment[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveOk, setSaveOk] = useState<string | null>(null);
    const baselineRef = useRef("");

    useEffect(() => {
      originalFlatRef.current = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
      const next = plannedSegmentsToCollapsedDayPaceState(
        segments,
        workoutType,
        fiveKSec
      );
      setEditSegments(next);
      baselineRef.current = JSON.stringify(next);
      setSaveError(null);
      setSaveOk(null);
    }, [segments, workoutType, fiveKSec]);

    const totalLabel = useMemo(
      () => formatTotalMilesFromCollapsedEditor(editSegments, originalFlatRef.current),
      [editSegments, segments]
    );

    const isDirty = useMemo(
      () => JSON.stringify(editSegments) !== baselineRef.current,
      [editSegments]
    );

    const hasWorkBlocks = useMemo(
      () => editSegments.some((s) => s.editorKind === "work"),
      [editSegments]
    );

    const shiftAllWorkPace = useCallback((deltaSecPerMile: number) => {
      setEditSegments((prev) =>
        prev.map((card) => {
          if (card.editorKind !== "work") return card;
          const { low, high } = parseCardPaceSecPerMile(card);
          if (low == null) return card;
          const shifted = shiftPaceBandSecPerMile(low, high, deltaSecPerMile);
          return applyPaceBandToCard(card, shifted.low, shifted.high);
        })
      );
    }, []);

    const saveSegments = useCallback(async (): Promise<boolean> => {
      if (editSegments.length === 0) return true;
      if (!isDirty) return true;
      setSaving(true);
      setSaveError(null);
      setSaveOk(null);
      try {
        const payload = saveCollapsedDayPaceSegments(
          editSegments,
          originalFlatRef.current
        );
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
        {hasWorkBlocks ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <span className="text-xs font-medium text-gray-700">Shift all work paces</span>
            <button
              type="button"
              onClick={() => shiftAllWorkPace(-5)}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-100"
            >
              −5 sec/mi
            </button>
            <button
              type="button"
              onClick={() => shiftAllWorkPace(5)}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-100"
            >
              +5 sec/mi
            </button>
          </div>
        ) : null}
        {editSegments.map((segment) => {
          const kind = segment.editorKind;
          const paceEditable = kind === "work" || kind === "recovery";
          const recoveryPaceEmpty =
            kind === "recovery" &&
            !segment.paceLowMin.trim() &&
            !segment.paceLowSec.trim() &&
            !segment.paceHighMin.trim() &&
            !segment.paceHighSec.trim();
          const repLabel =
            segment.displayRepCount > 1 ? (
              <span className="ml-2 text-[10px] font-semibold normal-case text-gray-500">
                × {segment.displayRepCount}
              </span>
            ) : null;
          return (
            <div
              key={segment.clientKey}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${dayPaceEditorKindHeaderClass(kind)}`}
              >
                {dayPaceEditorKindLabel(kind)}
                {repLabel}
              </div>
              <div className="p-4 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    {segment.durationType === "TIME" ? "Duration (minutes)" : "Distance"}
                    {segment.durationType === "DISTANCE" ? (
                      <span className="ml-2 rounded bg-orange-50 px-2 py-0.5 text-xs font-semibold normal-case text-orange-900">
                        {segment.distanceUnit}
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
                {paceEditable ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                        Pace low
                        {profileFiveKPace && kind === "work" ? (
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
                        {profileFiveKPace && kind === "work" ? (
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
                {recoveryPaceEmpty ? (
                  <p className="text-xs text-gray-500">
                    No recovery pace on this workout — jog at feel. Add paces above only if you
                    want a Garmin target.
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
        {totalLabel ? (
          <p className="text-sm font-medium text-gray-700 text-center tabular-nums">{totalLabel}</p>
        ) : null}
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
