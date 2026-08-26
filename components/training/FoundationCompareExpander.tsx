"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export type FoundationCompareRow = {
  rangeLabel: string;
  meaning: string;
  isSelected: boolean;
};

type Props = {
  label: string;
  rows: FoundationCompareRow[];
};

export function FoundationCompareExpander({ label, rows }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-orange-700 hover:text-orange-900"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li
              key={row.rangeLabel}
              className={`rounded-lg border px-3 py-2 text-xs ${
                row.isSelected
                  ? "border-orange-300 bg-orange-50 text-gray-900"
                  : "border-gray-200 bg-gray-50 text-gray-700"
              }`}
            >
              <p className="font-semibold">{row.rangeLabel}</p>
              <p className="mt-0.5">{row.meaning}</p>
              {row.isSelected ? (
                <p className="mt-1 font-medium text-orange-800">Your range</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
