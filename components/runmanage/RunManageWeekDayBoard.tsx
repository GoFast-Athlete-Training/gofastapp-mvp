"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import {
  runInstanceEditPath,
  runManageCreateFromSeriesPath,
} from "@/lib/runmanage/paths";
import type { OperationalSeriesRow, SeriesStoplight } from "@/lib/runmanage/series-operational-list";
import RunManageWeekValidateChecks, {
  validationReady,
  type WeekValidateFlags,
} from "@/components/runmanage/RunManageWeekValidateChecks";

const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

function formatSeriesTime(row: OperationalSeriesRow): string {
  const run = row.weekRun;
  const hour = run?.startTimeHour ?? row.startTimeHour;
  const minute = run?.startTimeMinute ?? row.startTimeMinute;
  const period = run?.startTimePeriod ?? row.startTimePeriod;
  if (hour == null) return "—";
  const min = String(minute ?? 0).padStart(2, "0");
  const p = period?.trim() || "";
  return `${hour}:${min}${p ? ` ${p}` : ""}`;
}

function stoplightLabel(status: SeriesStoplight): string {
  switch (status) {
    case "ready":
      return "Validated";
    case "needs_validate":
      return "Needs validate";
    case "needs_prepare":
      return "Prepare slot";
    case "build_first":
      return "Build first";
    default:
      return status;
  }
}

function stoplightClass(status: SeriesStoplight): string {
  switch (status) {
    case "ready":
      return "bg-emerald-100 text-emerald-900";
    case "needs_validate":
      return "bg-amber-100 text-amber-950";
    case "needs_prepare":
      return "bg-sky-100 text-sky-950";
    case "build_first":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

type SlotRowProps = {
  row: OperationalSeriesRow;
  onValidateChange: (seriesId: string, flags: WeekValidateFlags) => void;
};

function SlotRow({ row, onValidateChange }: SlotRowProps) {
  const run = row.weekRun;
  const meetUp = run?.meetUpPoint?.trim() || row.meetUpPoint?.trim() || "—";
  const buildHref = runManageCreateFromSeriesPath(row.seriesId, {
    dateYmd: row.weekSlotYmd ?? row.suggestedBuildDateYmd,
  });

  return (
    <li className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">{row.clubName ?? "Club"}</p>
        <p className="mt-0.5 text-xs text-gray-600">
          {formatSeriesTime(row)} · {meetUp}
        </p>
        {run ? (
          <div className="mt-2">
            <RunManageWeekValidateChecks
              runId={run.id}
              compact
              flags={{
                dateValidate: run.dateValidate,
                timeValidate: run.timeValidate,
                meetupValidate: run.meetupValidate,
              }}
              onUpdated={(flags) => onValidateChange(row.seriesId, flags)}
            />
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {run?.routeId ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-900">
            <MapPin className="h-3 w-3" />
            Route
          </span>
        ) : run ? (
          <span className="text-xs text-gray-500">Route optional</span>
        ) : null}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${stoplightClass(row.stoplight)}`}
        >
          {stoplightLabel(row.stoplight)}
        </span>
        {run ? (
          <Link
            href={runInstanceEditPath(run.id, row.runClubId)}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Open
          </Link>
        ) : row.stoplight === "build_first" ? (
          <Link
            href={buildHref}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Build first
          </Link>
        ) : (
          <span className="text-xs text-gray-500">Use Prepare this week</span>
        )}
      </div>
    </li>
  );
}

export function RunManageWeekDayBoard({
  rows,
  onRowsChange,
}: {
  rows: OperationalSeriesRow[];
  onRowsChange: (next: OperationalSeriesRow[]) => void;
}) {
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set(DAY_ORDER));

  const byDay = useMemo(() => {
    const map = new Map<string, OperationalSeriesRow[]>();
    for (const d of DAY_ORDER) map.set(d, []);
    for (const row of rows) {
      const key = row.dayOfWeek.trim().toUpperCase();
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const handleValidateChange = (seriesId: string, flags: WeekValidateFlags) => {
    onRowsChange(
      rows.map((r) => {
        if (r.seriesId !== seriesId || !r.weekRun) return r;
        const weekRun = { ...r.weekRun, ...flags };
        const validationReadyFlag = validationReady(flags);
        return {
          ...r,
          weekRun,
          nextRun: weekRun,
          validationReady: validationReadyFlag,
          stoplight: validationReadyFlag ? ("ready" as const) : ("needs_validate" as const),
        };
      })
    );
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center text-sm text-gray-500">
        No weekly slots for this city this week.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {DAY_ORDER.map((day) => {
        const dayRows = byDay.get(day) ?? [];
        if (dayRows.length === 0) return null;
        const needsValidate = dayRows.filter((r) => r.stoplight === "needs_validate").length;
        const needsPrepare = dayRows.filter((r) => r.stoplight === "needs_prepare").length;
        const open = openDays.has(day);
        return (
          <section
            key={day}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => {
                setOpenDays((prev) => {
                  const next = new Set(prev);
                  if (next.has(day)) next.delete(day);
                  else next.add(day);
                  return next;
                });
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                {open ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
                <span className="text-lg font-semibold text-gray-900">{formatDayLabel(day)}</span>
              </div>
              <p className="text-sm text-gray-600">
                {dayRows.length} slot{dayRows.length === 1 ? "" : "s"}
                {needsValidate ? ` · ${needsValidate} need validate` : ""}
                {needsPrepare ? ` · ${needsPrepare} need prepare` : ""}
              </p>
            </button>
            {open ? (
              <ul className="border-t border-gray-100 bg-gray-50/40">
                {dayRows.map((row) => (
                  <SlotRow key={row.seriesId} row={row} onValidateChange={handleValidateChange} />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
