"use client";

import type { WorkoutShape, WorkoutShapePiece, ShapeStep } from "@/lib/training/workout-shape-service";

function formatStepLine(step: ShapeStep): string {
  const dur =
    step.durationType === "TIME"
      ? `${step.durationValue} min`
      : `${step.durationValue} mi`;
  if (step.kind === "rest") return `${dur} · rest`;
  return `${dur} · ${step.effortLabel}`;
}

function renderPiece(piece: WorkoutShapePiece, index: number) {
  if (piece.kind === "bookend") {
    const dur =
      piece.durationType === "TIME"
        ? `${piece.durationValue} min`
        : `${piece.durationValue} mi`;
    return (
      <li key={`bookend-${index}`} className="text-sm text-gray-800">
        {piece.title}: {dur}
      </li>
    );
  }
  return (
    <li key={`repeat-${index}`} className="text-sm text-gray-800 space-y-1">
      <span className="font-semibold text-orange-900">Repeat {piece.repeatCount}×</span>
      <ul className="ml-3 list-disc pl-4 space-y-0.5">
        {piece.steps.map((step, i) => (
          <li key={i}>{formatStepLine(step)}</li>
        ))}
        {piece.betweenRepRest ? (
          <li className="text-gray-600">
            Between reps: {piece.betweenRepRest.durationValue}{" "}
            {piece.betweenRepRest.durationType === "TIME" ? "min" : "mi"}
          </li>
        ) : null}
      </ul>
    </li>
  );
}

type Props = {
  shape: WorkoutShape;
  onConfirm: () => void;
  onBack: () => void;
  applying?: boolean;
};

export default function WorkoutShapeConfirmPanel({
  shape,
  onConfirm,
  onBack,
  applying = false,
}: Props) {
  return (
    <div className="mb-8 rounded-lg border border-orange-200 bg-orange-50/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-900">Does this shape look right?</p>
      <p className="text-xs text-gray-600">Target labels only — paces come after you confirm.</p>
      <ul className="space-y-2 list-none pl-0 m-0">{shape.pieces.map(renderPiece)}</ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onConfirm}
          disabled={applying}
          className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {applying ? "Adding paces…" : "Looks right — add paces now"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Edit paste
        </button>
      </div>
    </div>
  );
}
