"use client";

import type { PlanWeekIngestRow } from "@/lib/training/plan-ingest-contract";

const STATUS_LABEL: Record<PlanWeekIngestRow["status"], string> = {
  import: "Import",
  skipped_race: "Skipped — race day",
  skipped_protected: "Skipped — protected",
  out_of_week: "Outside week",
  invalid: "Invalid row",
};

type Props = {
  rows: PlanWeekIngestRow[];
  title?: string;
};

export function PlanWeekCsvPreviewTable({ rows, title = "CSV rows" }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40">
      <p className="border-b border-amber-200/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
        {title}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-amber-100 text-left text-xs text-amber-900/80">
            <th className="px-3 py-1.5">Date</th>
            <th className="px-3 py-1.5">Workout</th>
            <th className="px-3 py-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.dateKey}-${i}`} className="border-b border-amber-100/80 last:border-0">
              <td className="px-3 py-2 text-gray-800">{row.dateKey || "—"}</td>
              <td className="px-3 py-2 text-gray-800">{row.workoutName || "—"}</td>
              <td className="px-3 py-2 text-xs text-gray-700">
                {STATUS_LABEL[row.status]}
                {row.detail ? ` — ${row.detail}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
