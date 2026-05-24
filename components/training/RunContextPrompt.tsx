"use client";

import { useState } from "react";
import {
  RUN_CONTEXT_OPTIONS,
  type RunContextOption,
} from "@/lib/training/coach-read-display";

type RunContextPromptProps = {
  className?: string;
};

/** Lightweight post-run context chips — UI only for now (no persistence). */
export default function RunContextPrompt({ className = "" }: RunContextPromptProps) {
  const [selected, setSelected] = useState<Set<RunContextOption>>(new Set());
  const [note, setNote] = useState("");

  function toggle(option: RunContextOption) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white/90 p-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
        Run context
      </p>
      <p className="mt-1 text-sm text-gray-600">What shaped this run?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {RUN_CONTEXT_OPTIONS.map((option) => {
          const active = selected.has(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                  : "bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Add note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Add note…"
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300"
        />
      </label>
    </div>
  );
}
