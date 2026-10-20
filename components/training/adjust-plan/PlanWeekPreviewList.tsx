"use client";

import type {
  PlanWeekIngestRow,
  PlanWeekPreviewDay,
} from "@/lib/training/plan-ingest-contract";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";
import { PlanWeekCsvPreviewTable } from "@/components/training/adjust-plan/PlanWeekCsvPreviewTable";

type Props = {
  days: PlanWeekPreviewDay[];
  summary?: string | null;
  ingestRows?: PlanWeekIngestRow[];
};

export function PlanWeekPreviewList({ days, summary, ingestRows }: Props) {
  const problemRows =
    ingestRows?.filter((r) => r.status !== "import" && r.status !== "skipped_protected") ?? [];
  const replaceDays = days.filter((d) => d.action === "replace");
  const keepDays = days.filter((d) => d.action === "keep");
  const totalMi = days.reduce((a, d) => a + d.miles, 0);

  return (
    <div className="space-y-4">
      {problemRows.length > 0 ? (
        <PlanWeekCsvPreviewTable rows={problemRows} title="Rows not applied" />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Workout</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Mi</th>
              <th className="px-3 py-2">Catalogue</th>
              <th className="px-3 py-2">Pace note</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr
                key={d.dateKey}
                className={`border-b border-gray-50 last:border-0 ${
                  d.action === "keep" ? "bg-gray-50/80 text-gray-600" : ""
                }`}
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-900">
                  {formatPlanDateDisplay(d.dateKey, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-3 py-2.5 text-gray-900">
                  {d.workoutName?.trim() || "—"}
                </td>
                <td className="px-3 py-2.5">{d.workoutType}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{d.miles}</td>
                <td className="max-w-[10rem] px-3 py-2.5 text-gray-800">
                  {d.catalogueMissing ? (
                    <span className="text-amber-800">No match — tell staff</span>
                  ) : d.catalogueName ? (
                    <span>
                      {d.catalogueName}
                      {d.catalogueApproximate ? (
                        <span className="block text-xs text-amber-800">Closest match</span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[14rem] px-3 py-2.5 text-gray-700">
                  {d.structurePreviewLines && d.structurePreviewLines.length > 0 ? (
                    <ul className="space-y-0.5 text-xs leading-snug">
                      {d.structurePreviewLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : d.paceNote?.trim() ? (
                    <span className="truncate">{d.paceNote}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {d.action === "keep" ? (
                    <span className="text-gray-600">
                      Unchanged
                      {d.keepReason === "race"
                        ? " (race day)"
                        : d.keepReason === "completed"
                          ? " (completed)"
                          : ""}
                    </span>
                  ) : (
                    <span className="font-medium text-sky-800">Will replace</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600">
        {replaceDays.length} day(s) will update
        {keepDays.length > 0 ? ` · ${keepDays.length} unchanged` : ""}
        {totalMi > 0 ? ` · ~${Math.round(totalMi)} mi on scheduled days` : ""}
      </p>
      {summary ? (
        <p className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-sm text-gray-800">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
