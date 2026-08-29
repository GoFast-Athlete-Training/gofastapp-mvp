"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export const PACE_ADJUSTER_STEP_SEC = 5;
export const PACE_ADJUSTER_MIN = -120;
export const PACE_ADJUSTER_MAX = 120;

function clampSigned(n: number): number {
  return Math.max(PACE_ADJUSTER_MIN, Math.min(PACE_ADJUSTER_MAX, n));
}

function parseSignedInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "" || t === "-" || t === "+") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return clampSigned(Math.round(n));
}

export function SignedSecPerMileStepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [value]);

  const display = draft ?? String(value);

  const bump = (delta: number) => {
    onChange(clampSigned(value + delta));
    setDraft(null);
  };

  const commitDraft = (raw: string) => {
    const parsed = parseSignedInput(raw);
    if (parsed != null) {
      onChange(parsed);
      setDraft(null);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      <div className="rounded-lg border border-gray-300 overflow-hidden bg-white shadow-sm">
        <button
          type="button"
          disabled={disabled}
          aria-label={`Increase ${label}`}
          onClick={() => bump(PACE_ADJUSTER_STEP_SEC)}
          className="w-full flex justify-center py-1 bg-gray-50 hover:bg-gray-100 border-b border-gray-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronUp className="w-4 h-4 text-gray-700" strokeWidth={2.25} />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          autoComplete="off"
          className="w-full border-0 px-2 py-2 text-sm text-center tabular-nums text-gray-900 focus:ring-2 focus:ring-inset focus:ring-orange-500"
          value={display}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^[+-]?\d*$/.test(v)) {
              setDraft(v);
              const parsed = parseSignedInput(v);
              if (parsed != null) onChange(parsed);
            }
          }}
          onBlur={() => commitDraft(display)}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={`Decrease ${label}`}
          onClick={() => bump(-PACE_ADJUSTER_STEP_SEC)}
          className="w-full flex justify-center py-1 bg-gray-50 hover:bg-gray-100 border-t border-gray-200 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronDown className="w-4 h-4 text-gray-700" strokeWidth={2.25} />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {value < 0 ? `${Math.abs(value)} sec/mi faster` : value > 0 ? `${value} sec/mi slower` : "No change"}
        {" · "}
        ±{PACE_ADJUSTER_STEP_SEC} per tap
      </p>
    </div>
  );
}
