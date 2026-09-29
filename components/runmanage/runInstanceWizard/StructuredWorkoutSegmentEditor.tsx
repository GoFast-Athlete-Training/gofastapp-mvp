"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  createEmptySegment,
  formatSegmentSummary,
  PACE_OFFSET_PRESETS,
  stepTypeToKind,
  type EditableWorkoutSegment,
  type SegmentKind,
  type DisplayUnit,
  WORK_STEP_TYPES,
  validateEditableSegments,
} from "@/lib/group-workout-segment-editor";

type Props = {
  segments: EditableWorkoutSegment[];
  workoutTitle: string;
  onSegmentsChange: (segments: EditableWorkoutSegment[]) => void;
  onWorkoutTitleChange: (title: string) => void;
};

const KIND_LABELS: Record<SegmentKind, string> = {
  warmup: "Warmup",
  work: "Work / Intervals",
  cooldown: "Cooldown",
};

const UNIT_OPTIONS: DisplayUnit[] = ["meters", "miles", "minutes"];

const BOOKEND_STEP_TYPES = ["Warmup", "Cooldown"] as const;

function SegmentKindBadge({ kind }: { kind: SegmentKind }) {
  const colors: Record<SegmentKind, string> = {
    warmup: "bg-gray-200 text-gray-800",
    work: "bg-orange-100 text-orange-900",
    cooldown: "bg-gray-200 text-gray-800",
  };
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${colors[kind]}`}>
      {KIND_LABELS[kind]}
    </span>
  );
}

export default function StructuredWorkoutSegmentEditor({
  segments,
  workoutTitle,
  onSegmentsChange,
  onWorkoutTitleChange,
}: Props) {
  const issues = validateEditableSegments(segments);

  function patchSegment(id: string, partial: Partial<EditableWorkoutSegment>) {
    onSegmentsChange(
      segments.map((seg) => (seg.id === id ? { ...seg, ...partial } : seg))
    );
  }

  function moveSegment(id: string, direction: "up" | "down") {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = direction === "up" ? idx - 1 : idx + 1;
    if (next < 0 || next >= segments.length) return;
    const copy = [...segments];
    [copy[idx], copy[next]] = [copy[next]!, copy[idx]!];
    onSegmentsChange(copy.map((s, i) => ({ ...s, stepOrder: i + 1 })));
  }

  function removeSegment(id: string) {
    onSegmentsChange(segments.filter((s) => s.id !== id).map((s, i) => ({ ...s, stepOrder: i + 1 })));
  }

  function addSegment(kind: SegmentKind) {
    onSegmentsChange([...segments, createEmptySegment(kind, segments.length + 1)]);
  }

  function handleStepTypeChange(seg: EditableWorkoutSegment, stepType: string) {
    const kind = stepTypeToKind(stepType);
    patchSegment(seg.id, {
      stepType,
      kind,
      repeatCount: kind === "work" ? seg.repeatCount ?? 5 : null,
      paceOffsetSecPerMile: kind === "work" ? seg.paceOffsetSecPerMile ?? 15 : null,
      paceOffsetPreset: kind === "work" ? seg.paceOffsetPreset ?? "10k" : "custom",
      recoveryDisplayValue: kind === "work" ? seg.recoveryDisplayValue ?? 400 : null,
      recoveryDisplayUnit: kind === "work" ? seg.recoveryDisplayUnit ?? "meters" : null,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700">Workout name</label>
        <p className="mt-0.5 text-xs text-gray-500">Short label for this session (e.g. 1600m repeats).</p>
        <input
          type="text"
          value={workoutTitle}
          onChange={(e) => onWorkoutTitleChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">Summary</p>
        <ul className="mt-1 space-y-0.5 text-sm text-sky-950">
          {segments.map((seg) => (
            <li key={seg.id}>{formatSegmentSummary(seg)}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {segments.map((seg, index) => {
          const segIssues = issues.filter((i) => i.id === seg.id);
          const stepTypeOptions =
            seg.kind === "work"
              ? WORK_STEP_TYPES
              : BOOKEND_STEP_TYPES.filter((t) => stepTypeToKind(t) === seg.kind);

          return (
            <div
              key={seg.id}
              className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tabular-nums text-gray-400">{index + 1}</span>
                  <SegmentKindBadge kind={seg.kind} />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSegment(seg.id, "up")}
                    disabled={index === 0}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSegment(seg.id, "down")}
                    disabled={index === segments.length - 1}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSegment(seg.id)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="Remove segment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Step type</label>
                  <select
                    value={seg.stepType}
                    onChange={(e) => handleStepTypeChange(seg, e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {stepTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Distance / time</label>
                    <input
                      type="number"
                      min={0}
                      step={seg.displayUnit === "meters" ? 50 : 0.1}
                      value={seg.displayValue}
                      onChange={(e) =>
                        patchSegment(seg.id, { displayValue: parseFloat(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Unit</label>
                    <select
                      value={seg.displayUnit}
                      onChange={(e) => {
                        const displayUnit = e.target.value as DisplayUnit;
                        patchSegment(seg.id, {
                          displayUnit,
                          durationType: displayUnit === "minutes" ? "TIME" : "DISTANCE",
                        });
                      }}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {seg.kind === "work" ? (
                <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Repeat count</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={seg.repeatCount ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          patchSegment(seg.id, {
                            repeatCount: raw ? parseInt(raw, 10) : null,
                          });
                        }}
                        placeholder="1"
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Pace preset</label>
                      <select
                        value={seg.paceOffsetPreset}
                        onChange={(e) => {
                          const presetId = e.target.value as EditableWorkoutSegment["paceOffsetPreset"];
                          const preset = PACE_OFFSET_PRESETS.find((p) => p.id === presetId);
                          patchSegment(seg.id, {
                            paceOffsetPreset: presetId,
                            paceOffsetSecPerMile:
                              preset?.offset != null ? preset.offset : seg.paceOffsetSecPerMile,
                          });
                        }}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {PACE_OFFSET_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Pace offset (sec/mi vs 5K)
                    </label>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Positive = slower than 5K fitness. 10K ≈ +15 sec/mi above 5K.
                    </p>
                    <input
                      type="number"
                      step={1}
                      value={seg.paceOffsetSecPerMile ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const offset = raw === "" ? null : parseInt(raw, 10);
                        patchSegment(seg.id, {
                          paceOffsetSecPerMile: Number.isFinite(offset) ? offset : null,
                          paceOffsetPreset: "custom",
                        });
                      }}
                      placeholder="15"
                      className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600">
                        Between-rep recovery
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={seg.recoveryDisplayUnit === "minutes" ? 0.5 : 50}
                        value={seg.recoveryDisplayValue ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          patchSegment(seg.id, {
                            recoveryDisplayValue: raw ? parseFloat(raw) : null,
                          });
                        }}
                        placeholder="400"
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Recovery unit</label>
                      <select
                        value={seg.recoveryDisplayUnit ?? "meters"}
                        onChange={(e) =>
                          patchSegment(seg.id, {
                            recoveryDisplayUnit: e.target.value as DisplayUnit,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              {segIssues.length > 0 ? (
                <ul className="mt-2 space-y-0.5">
                  {segIssues.map((issue) => (
                    <li key={issue.message} className="text-xs text-red-600">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => addSegment("warmup")}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add warmup
        </button>
        <button
          type="button"
          onClick={() => addSegment("work")}
          className="inline-flex items-center gap-1 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-900 hover:bg-orange-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Add work
        </button>
        <button
          type="button"
          onClick={() => addSegment("cooldown")}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add cooldown
        </button>
      </div>

      {issues.some((i) => i.id === "all") ? (
        <p className="text-xs text-red-600">{issues.find((i) => i.id === "all")?.message}</p>
      ) : null}
    </div>
  );
}

export { validateEditableSegments };
