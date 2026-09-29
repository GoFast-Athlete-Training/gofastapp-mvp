"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import api from "@/lib/runmanage/api-client";
import WorkoutStructurePreview from "@/components/training/WorkoutStructurePreview";
import type { WorkoutPreviewSegment } from "@/lib/training/workout-segment-preview";
import {
  apiSegmentToEditable,
  editableSegmentsToApi,
  type EditableWorkoutSegment,
  type GroupWorkoutSegment,
} from "@/lib/group-workout-segment-editor";
import StructuredWorkoutSegmentEditor, {
  validateEditableSegments,
} from "./StructuredWorkoutSegmentEditor";

export type { GroupWorkoutSegment };

export type TrackWorkoutBuilderValues = {
  trackWorkoutDescription: string;
  plannedWorkoutId: string;
  attachedWorkoutTitle: string;
};

export type PendingClubPlannedWorkout = {
  title: string;
  workoutType: string;
  segments: GroupWorkoutSegment[];
};

export const CLUB_WORKOUT_TYPES = ["Easy", "Tempo", "Intervals", "LongRun", "Race"] as const;
export type ClubWorkoutType = (typeof CLUB_WORKOUT_TYPES)[number];

type WorkoutBuildMode = "ai" | "manual";

export type TrackWorkoutBuilderProps = {
  clubId: string;
  cityRunId?: string | null;
  runDate?: string | null;
  values: TrackWorkoutBuilderValues;
  onChange: (partial: Partial<TrackWorkoutBuilderValues>) => void;
  onPendingPlannedWorkout?: (payload: PendingClubPlannedWorkout | null) => void;
  onError?: (msg: string | null) => void;
  /** When true, defer API until parent saves the run instance. */
  pendingSave?: boolean;
  /** Hydrate editor when editing an existing attached planned workout. */
  initialSegments?: GroupWorkoutSegment[] | null;
  initialWorkoutTitle?: string | null;
  initialWorkoutType?: string | null;
};

function segmentsToPreview(segments: GroupWorkoutSegment[]): WorkoutPreviewSegment[] {
  return segments.map((seg, i) => ({
    id: `preview-${i}-${seg.stepOrder}`,
    stepOrder: seg.stepOrder,
    title: seg.title,
    durationType: seg.durationType,
    durationValue: seg.durationValue,
    repeatCount: seg.repeatCount,
    notes: seg.notes,
    recoveryDurationType: seg.recoveryDurationType,
    recoveryDurationValue: seg.recoveryDurationValue,
    targets: seg.targets,
  }));
}

export default function TrackWorkoutBuilder({
  clubId,
  cityRunId,
  runDate,
  values,
  onChange,
  onPendingPlannedWorkout,
  onError,
  pendingSave = false,
  initialSegments,
  initialWorkoutTitle,
  initialWorkoutType,
}: TrackWorkoutBuilderProps) {
  const [buildMode, setBuildMode] = useState<WorkoutBuildMode>("ai");
  const [workoutType, setWorkoutType] = useState<ClubWorkoutType>(() => {
    const t = initialWorkoutType?.trim();
    if (t && (CLUB_WORKOUT_TYPES as readonly string[]).includes(t)) {
      return t as ClubWorkoutType;
    }
    return "Intervals";
  });
  const [editableSegments, setEditableSegments] = useState<EditableWorkoutSegment[]>([]);
  const [structuredWorkoutTitle, setStructuredWorkoutTitle] = useState("");
  const [structuringWorkout, setStructuringWorkout] = useState(false);
  const [creatingWorkout, setCreatingWorkout] = useState(false);
  const [editingAttached, setEditingAttached] = useState(false);

  const { trackWorkoutDescription, plannedWorkoutId, attachedWorkoutTitle } = values;

  const previewSegments = useMemo(() => {
    if (editableSegments.length > 0) {
      return segmentsToPreview(editableSegmentsToApi(editableSegments));
    }
    if (initialSegments?.length && !editingAttached && plannedWorkoutId && attachedWorkoutTitle) {
      return segmentsToPreview(initialSegments);
    }
    return [];
  }, [
    editableSegments,
    initialSegments,
    editingAttached,
    plannedWorkoutId,
    attachedWorkoutTitle,
  ]);

  function clearStructuredDraft() {
    setEditableSegments([]);
    setStructuredWorkoutTitle("");
    onPendingPlannedWorkout?.(null);
  }

  function startEditingAttached() {
    setEditingAttached(true);
    setBuildMode("manual");
    if (initialSegments?.length) {
      setEditableSegments(initialSegments.map((seg, i) => apiSegmentToEditable(seg, i)));
      setStructuredWorkoutTitle(initialWorkoutTitle?.trim() || attachedWorkoutTitle || "Workout");
    } else {
      clearStructuredDraft();
    }
  }

  function detachWorkout() {
    onChange({
      plannedWorkoutId: "",
      attachedWorkoutTitle: "",
    });
    clearStructuredDraft();
    setEditingAttached(false);
    onPendingPlannedWorkout?.(null);
  }

  const handleStructureWorkout = async () => {
    const text = trackWorkoutDescription.trim();
    if (!text) {
      onError?.("Paste workout text first.");
      return;
    }
    setStructuringWorkout(true);
    onError?.(null);
    try {
      const res = await api.post("/api/workouts/group/parse", {
        sourceText: text,
        workoutType,
      });
      const data = res.data as {
        success?: boolean;
        error?: string;
        segments?: GroupWorkoutSegment[];
        suggestedTitle?: string;
        suggestedDescription?: string;
      };
      if (!data?.success || !Array.isArray(data.segments) || data.segments.length === 0) {
        throw new Error(data?.error || "Could not structure workout.");
      }
      setEditableSegments(data.segments.map((seg, i) => apiSegmentToEditable(seg, i)));
      setStructuredWorkoutTitle(data.suggestedTitle?.trim() || "Workout");
      setEditingAttached(true);
      if (data.suggestedDescription?.trim()) {
        onChange({ trackWorkoutDescription: data.suggestedDescription.trim() });
      }
      onPendingPlannedWorkout?.(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      onError?.(err.response?.data?.error || err.message || "Structure workout failed.");
    } finally {
      setStructuringWorkout(false);
    }
  };

  const handleCreateWorkout = async () => {
    if (editableSegments.length === 0) {
      onError?.("Add or parse workout segments first.");
      return;
    }
    const validationIssues = validateEditableSegments(editableSegments);
    if (validationIssues.length > 0) {
      onError?.(validationIssues[0]?.message ?? "Fix segment fields before attaching.");
      return;
    }
    if (!clubId.trim() && !cityRunId?.trim() && !pendingSave) {
      onError?.("Save the run first, then attach a workout.");
      return;
    }

    const apiSegments = editableSegmentsToApi(editableSegments);
    const title = structuredWorkoutTitle.trim() || "Workout";
    const payload: PendingClubPlannedWorkout = {
      title,
      workoutType,
      segments: apiSegments,
    };

    if (pendingSave || !cityRunId?.trim()) {
      onChange({
        plannedWorkoutId: "pending",
        attachedWorkoutTitle: title,
      });
      onPendingPlannedWorkout?.(payload);
      setEditableSegments([]);
      setEditingAttached(false);
      return;
    }

    setCreatingWorkout(true);
    onError?.(null);
    try {
      const res = await api.post(`/api/runs/${cityRunId.trim()}/planned-workout`, {
        title,
        description: trackWorkoutDescription.trim() || null,
        workoutType,
        date: runDate || new Date().toISOString(),
        segments: apiSegments,
      });
      const data = res.data as {
        success?: boolean;
        error?: string;
        plannedWorkout?: { id?: string; title?: string };
      };
      if (!data?.success || !data.plannedWorkout?.id) {
        throw new Error(data?.error || "Could not create workout.");
      }
      onChange({
        plannedWorkoutId: data.plannedWorkout.id,
        attachedWorkoutTitle: data.plannedWorkout.title?.trim() || title,
      });
      setEditableSegments([]);
      setEditingAttached(false);
      onPendingPlannedWorkout?.(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      onError?.(err.response?.data?.error || err.message || "Create workout failed.");
    } finally {
      setCreatingWorkout(false);
    }
  };

  const canAttach =
    editableSegments.length > 0 && validateEditableSegments(editableSegments).length === 0;

  if (attachedWorkoutTitle && plannedWorkoutId && !editingAttached && editableSegments.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Workout attached: {attachedWorkoutTitle}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                <span className="font-medium">This instance only</span>
                {pendingSave || plannedWorkoutId === "pending"
                  ? " — links when you save the run."
                  : " — saved with this run."}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={startEditingAttached}
                className="text-xs font-medium text-violet-700 hover:text-violet-900"
              >
                Edit workout
              </button>
              <button
                type="button"
                onClick={detachWorkout}
                className="text-xs font-medium text-red-700 hover:text-red-900"
              >
                Detach
              </button>
            </div>
          </div>
        </div>
        {previewSegments.length > 0 ? (
          <WorkoutStructurePreview segments={previewSegments} workoutType={workoutType} compact />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Workout type</label>
          <select
            value={workoutType}
            onChange={(e) => setWorkoutType(e.target.value as ClubWorkoutType)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {CLUB_WORKOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex rounded-lg border border-gray-200 p-0.5">
          <button
            type="button"
            onClick={() => setBuildMode("ai")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              buildMode === "ai" ? "bg-violet-100 text-violet-900" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            AI builder
          </button>
          <button
            type="button"
            onClick={() => setBuildMode("manual")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              buildMode === "manual"
                ? "bg-violet-100 text-violet-900"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      {buildMode === "ai" ? (
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-900">Workout text</label>
            <button
              type="button"
              onClick={() => void handleStructureWorkout()}
              disabled={structuringWorkout || !trackWorkoutDescription.trim()}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-2.5 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
            >
              {structuringWorkout ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Parse workout
            </button>
          </div>
          <textarea
            value={trackWorkoutDescription}
            onChange={(e) => {
              onChange({ trackWorkoutDescription: e.target.value });
            }}
            rows={4}
            placeholder="1 mile warmup, 5 x 1600m @ 10K pace with 400m recovery, 1 mile cooldown"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      {(buildMode === "manual" || editableSegments.length > 0) ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900">Structured workout</p>
            {editableSegments.length > 0 ? (
              <button
                type="button"
                onClick={clearStructuredDraft}
                className="text-xs font-medium text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            ) : null}
          </div>

          <StructuredWorkoutSegmentEditor
            segments={editableSegments}
            workoutTitle={structuredWorkoutTitle}
            onSegmentsChange={setEditableSegments}
            onWorkoutTitleChange={setStructuredWorkoutTitle}
          />

          <button
            type="button"
            onClick={() => void handleCreateWorkout()}
            disabled={creatingWorkout || !canAttach}
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {creatingWorkout ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Attach workout
          </button>
        </div>
      ) : null}

      {previewSegments.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Preview</p>
          <WorkoutStructurePreview segments={previewSegments} workoutType={workoutType} />
        </div>
      ) : null}
    </div>
  );
}
