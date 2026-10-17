"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import {
  runInstanceEditPath,
  runManageCreateFromSeriesPath,
} from "@/lib/runmanage/paths";
import type { OperationalSeriesRow, SeriesStoplight } from "@/lib/runmanage/series-operational-list";

function formatSeriesTime(row: OperationalSeriesRow): string {
  if (row.startTimeHour == null) return "—";
  const min = String(row.startTimeMinute ?? 0).padStart(2, "0");
  const p = row.startTimePeriod?.trim() || "";
  return `${row.startTimeHour}:${min}${p ? ` ${p}` : ""}`;
}

function StoplightDot({ status }: { status: SeriesStoplight }) {
  const color =
    status === "ready" ? "bg-emerald-500" : status === "build_first" ? "bg-amber-400" : "bg-amber-500";
  const label =
    status === "ready" ? "Next run built" : status === "build_first" ? "Build first run" : "Build next run";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600" title={label}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function RunManageOperationalSeriesTable({ rows }: { rows: OperationalSeriesRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center text-sm text-gray-500">
        No series match these filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-4 py-3">Day & time</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const buildHref = runManageCreateFromSeriesPath(row.seriesId, {
              dateYmd: row.suggestedBuildDateYmd,
            });
            return (
              <tr key={row.seriesId} className="hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StoplightDot status={row.stoplight} />
                    <span className="font-medium text-gray-900">
                      {formatDayLabel(row.dayOfWeek)} · {formatSeriesTime(row)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">Club</td>
                <td className="px-4 py-3 text-gray-800">
                  {row.clubName ?? "—"}
                  {row.clubCity ? (
                    <span className="text-gray-500"> · {row.clubCity}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.nextRun ? (
                    <Link
                      href={runInstanceEditPath(row.nextRun.id, row.runClubId)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Open run
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <Link
                      href={buildHref}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Build next run
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
