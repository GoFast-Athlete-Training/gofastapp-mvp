"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { PhaseRange } from "@/lib/training/plan-phases";
import { phaseNameForWeek } from "@/lib/training/plan-phases";

export type PlanWeekRow = {
  weekNumber: number;
  phase: string;
  schedule: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  phases: PhaseRange[];
  planWeeks: PlanWeekRow[];
  onJumpToWeek?: (weekNumber: number) => void;
};

export default function PhaseViewModal({
  open,
  onClose,
  phases,
  planWeeks,
  onJumpToWeek,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phase-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 id="phase-modal-title" className="text-lg font-semibold text-gray-900">
            Plan structure
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-6">
          {phases.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">
                Phases
              </p>
              <ul className="space-y-3">
                {phases.map((p, i) => (
                  <li
                    key={`${p.name}-${p.startWeek}-${i}`}
                    className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-sm font-semibold text-orange-800">
                      {p.startWeek === p.endWeek
                        ? p.startWeek
                        : `${p.startWeek}–${p.endWeek}`}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 capitalize">
                        {p.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Weeks {p.startWeek}–{p.endWeek}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No phase breakdown saved for this plan.</p>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">
              Weeks
            </p>
            <ul className="space-y-2">
              {planWeeks.map((w) => {
                const label = phaseNameForWeek(phases, w.weekNumber, w.phase);
                return (
                  <li
                    key={w.weekNumber}
                    className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-gray-900">
                          Week {w.weekNumber}
                        </span>
                        <span className="ml-2 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                          {label}
                        </span>
                      </div>
                      {onJumpToWeek && (
                        <button
                          type="button"
                          onClick={() => {
                            onJumpToWeek(w.weekNumber);
                            onClose();
                          }}
                          className="text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          Preview
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-gray-700 leading-relaxed break-words">
                      {w.schedule || "—"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
