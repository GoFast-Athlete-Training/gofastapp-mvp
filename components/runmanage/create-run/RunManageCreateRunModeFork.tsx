"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { RUN_MANAGE_SERIES_PATH, runManageCreatePath } from "@/lib/runmanage/paths";

export type CreateRunMode = "regular" | "series";

type Props = {
  mode: CreateRunMode;
  onModeChange: (mode: CreateRunMode) => void;
  seriesPicker?: ReactNode;
};

export default function RunManageCreateRunModeFork({
  mode,
  onModeChange,
  seriesPicker,
}: Props) {
  return (
    <div className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-gray-900">What are you creating?</p>
        <p className="mt-0.5 text-xs text-gray-600">
          Regular run is a one-off. From series seeds date, time, and meet-up from a weekly slot.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onModeChange("regular")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === "regular"
              ? "bg-sky-600 text-white"
              : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
          }`}
        >
          Regular run
        </button>
        <button
          type="button"
          onClick={() => onModeChange("series")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === "series"
              ? "bg-amber-600 text-white"
              : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
          }`}
        >
          From weekly series
        </button>
        <Link
          href={RUN_MANAGE_SERIES_PATH}
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100"
        >
          Browse all series
        </Link>
        {mode === "regular" ? (
          <Link
            href={runManageCreatePath()}
            className="sr-only"
            aria-hidden
          >
            reset
          </Link>
        ) : null}
      </div>
      {mode === "series" ? seriesPicker : null}
    </div>
  );
}
