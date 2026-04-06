"use client";

import { useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { PACE_MIN_STEPPER_MAX, paceSecondsStepperDisplay } from "@/lib/workout/pace-mi-split";

export function PaceMiSplitEditor({
  minValue,
  secValue,
  onMinChange,
  onSecChange,
  disabled,
}: {
  minValue: string;
  secValue: string;
  onMinChange: (v: string) => void;
  onSecChange: (v: string) => void;
  disabled?: boolean;
}) {
  const minRef = useRef<HTMLInputElement>(null);
  const secRef = useRef<HTMLInputElement>(null);

  const bumpMin = (delta: number) => {
    const cur = minValue.trim() === "" ? 0 : parseInt(minValue, 10);
    const n = Number.isFinite(cur) ? cur : 0;
    const next = Math.max(0, Math.min(PACE_MIN_STEPPER_MAX, n + delta));
    onMinChange(String(next));
  };

  const bumpSec = (delta: number) => {
    let cur = secValue.trim() === "" ? 0 : parseInt(secValue, 10);
    if (!Number.isFinite(cur)) cur = 0;
    let next = cur + delta;
    while (next < 0) next += 60;
    while (next > 59) next -= 60;
    onSecChange(String(next).padStart(2, "0"));
  };

  const stepperCol = (label: string, value: string, which: "min" | "sec") => (
    <div className="w-20 sm:w-24 shrink-0">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <div className="rounded-lg border border-gray-300 overflow-hidden bg-white shadow-sm">
        <button
          type="button"
          disabled={disabled}
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => (which === "min" ? bumpMin(1) : bumpSec(1))}
          className="w-full flex justify-center py-1 bg-gray-50 hover:bg-gray-100 border-b border-gray-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronUp className="w-4 h-4 text-gray-700" strokeWidth={2.25} />
        </button>
        <input
          ref={which === "min" ? minRef : secRef}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          autoComplete="off"
          className="w-full border-0 px-2 py-2 text-sm text-center tabular-nums text-gray-900 focus:ring-2 focus:ring-inset focus:ring-orange-500 focus:z-10 relative"
          value={value}
          onChange={(e) => {
            if (which === "min") {
              const v = e.target.value;
              if (v === "" || /^\d+$/.test(v)) onMinChange(v);
            } else {
              const v = e.target.value.replace(/\D/g, "");
              if (v === "") {
                onSecChange("");
                return;
              }
              const n = parseInt(v, 10);
              if (!Number.isFinite(n)) return;
              onSecChange(String(Math.min(59, n)).padStart(2, "0"));
            }
          }}
          onKeyDown={(e) => {
            if (which !== "min") return;
            if (
              (e.key === "Tab" || e.key === "Enter") &&
              !e.shiftKey &&
              secRef.current
            ) {
              e.preventDefault();
              secRef.current.focus();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => (which === "min" ? bumpMin(-1) : bumpSec(-1))}
          className="w-full flex justify-center py-1 bg-gray-50 hover:bg-gray-100 border-t border-gray-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronDown className="w-4 h-4 text-gray-700" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex items-end gap-2 flex-wrap">
      {stepperCol("Minutes", minValue, "min")}
      <span className="text-xl text-gray-400 pb-2 select-none" aria-hidden>
        :
      </span>
      {stepperCol("Seconds", paceSecondsStepperDisplay(secValue), "sec")}
      <span className="text-xs text-gray-500 pb-2 select-none">/mi</span>
    </div>
  );
}
