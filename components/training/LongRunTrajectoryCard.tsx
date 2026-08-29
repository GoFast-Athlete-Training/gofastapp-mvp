"use client";

import { formatPlanDateDisplay } from "@/lib/training/plan-utils";
import type { LongRunTrajectoryRow } from "@/lib/training/long-run-trajectory-preview";
import { peakLongRunPoolFoundationKey } from "@/lib/training/long-run-pool-fields";

export type LongRunTrajectoryCardProps = {
  peakLongRunPoolMiles: number;
  onPeakLongRunPoolMilesChange?: (value: number) => void;
  editable?: boolean;
  totalWeeks: number;
  currentWeek?: number | null;
  rows: LongRunTrajectoryRow[];
  peakWeekNumber?: number | null;
  peakBlock?: { startWeek: number; endWeek: number } | null;
  /** When true, rows reflect a live preview (pool changed but plan not regenerated). */
  previewMode?: boolean;
};

function formatSaturdayDate(dateYmd: string | null): string {
  if (!dateYmd) return "";
  return formatPlanDateDisplay(dateYmd, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function LongRunTrajectoryCard({
  peakLongRunPoolMiles,
  onPeakLongRunPoolMilesChange,
  editable = false,
  totalWeeks,
  currentWeek,
  rows,
  peakWeekNumber,
  peakBlock,
  previewMode = false,
}: LongRunTrajectoryCardProps) {
  const peakPoolRounded = Math.round(peakLongRunPoolMiles * 10) / 10;
  const bandLine = peakLongRunPoolFoundationKey(peakPoolRounded);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">Long-run trajectory</p>
      <p className="mt-2 text-sm text-gray-700">
        Based on your peak cycle pool and{" "}
        <span className="font-medium text-gray-900">{totalWeeks} weeks</span> to race, here is
        how we build your Saturday long runs. Change the peak pool if you want those miles higher
        or lower.
      </p>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Peak cycle pool total
        </label>
        <p className="mb-2 text-xs text-gray-600">
          Sum of four Saturday long runs in your peak block — not weekly mileage.
        </p>
        {editable && onPeakLongRunPoolMilesChange ? (
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            min={40}
            max={90}
            className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base font-semibold text-orange-600 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            value={Number.isFinite(peakPoolRounded) ? peakPoolRounded : ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) {
                onPeakLongRunPoolMilesChange(Math.round(n * 10) / 10);
              }
            }}
          />
        ) : (
          <p className="text-lg font-bold text-orange-600">{peakPoolRounded} mi</p>
        )}
        {bandLine ? (
          <p className="mt-1 text-xs font-medium text-orange-800">{bandLine}</p>
        ) : null}
      </div>

      {peakBlock ? (
        <p className="mt-3 text-xs text-gray-600">
          Peak block: weeks {peakBlock.startWeek}–{peakBlock.endWeek}
          {peakWeekNumber != null ? ` · peak week ${peakWeekNumber}` : ""}
        </p>
      ) : null}

      {previewMode ? (
        <p className="mt-2 text-xs font-medium text-amber-800">
          Preview — regenerate your plan to apply a new peak pool to your schedule.
        </p>
      ) : null}

      <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Week</th>
              <th className="px-3 py-2">Saturday</th>
              <th className="px-3 py-2 text-right">Miles</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isCurrent = currentWeek != null && row.weekNumber === currentWeek;
              return (
                <tr
                  key={row.weekNumber}
                  className={[
                    "border-t border-gray-100",
                    isCurrent ? "bg-orange-50" : row.isPeakBlock ? "bg-orange-50/40" : "",
                  ].join(" ")}
                >
                  <td className="px-3 py-2 tabular-nums text-gray-900">
                    {row.weekNumber}
                    {isCurrent ? (
                      <span className="ml-1.5 text-xs font-semibold text-orange-700">
                        (now)
                      </span>
                    ) : row.isPeakBlock ? (
                      <span className="ml-1.5 text-xs font-medium text-orange-600">peak</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {row.date ? formatSaturdayDate(row.date) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">
                    {row.miles.toFixed(1)} mi
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
