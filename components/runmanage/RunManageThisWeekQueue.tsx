"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { appendScopeToPath, scopeFromSearchParams } from "@/lib/runmanage/scope-query";
import type { OperationalSeriesRow } from "@/lib/runmanage/series-operational-list";
import type { WeekWindow } from "@/lib/runmanage/calendar-week";
import {
  checkSeriesDateStamp,
  seriesDateStampLabel,
  type SeriesDateStampRowKind,
} from "@/lib/runmanage/series-date-stamp-check";
import {
  runManageCreateFromSeriesPath,
  RUN_MANAGE_SERIES_PATH,
} from "@/lib/runmanage/paths";

function formatTime(hour: number | null, minute: number | null, period: string | null) {
  if (hour === null || minute === null) return "—";
  const minStr = minute.toString().padStart(2, "0");
  return `${hour}:${minStr} ${period || "AM"}`;
}

function kindBadgeClass(kind: SeriesDateStampRowKind): string {
  switch (kind) {
    case "open":
      return "bg-emerald-100 text-emerald-900";
    case "reuse_last_run":
      return "bg-amber-100 text-amber-950";
    case "build_first_run":
      return "bg-sky-100 text-sky-900";
    case "stamp_incomplete":
      return "bg-gray-200 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function RunManageThisWeekQueue() {
  const searchParams = useSearchParams();
  const scope = scopeFromSearchParams(searchParams);
  const weekOffset = parseInt(searchParams.get("weekOffset") ?? "0", 10) || 0;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OperationalSeriesRow[]>([]);
  const [weekWindow, setWeekWindow] = useState<WeekWindow | null>(null);
  const [actingSeriesId, setActingSeriesId] = useState<string | null>(null);

  const scoped = (path: string) => appendScopeToPath(path, scope);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view: "week" });
      if (scope.region) params.set("region", scope.region);
      if (scope.city) params.set("city", scope.city);
      if (weekOffset) params.set("weekOffset", String(weekOffset));
      const res = await runmanageApi.get(`/api/runmanage/run-series?${params.toString()}`);
      if (!res.data?.success) {
        setError(res.data?.error || "Failed to load weekly slots");
        setRows([]);
        return;
      }
      setWeekWindow(res.data.window ?? null);
      setRows((res.data.series ?? []) as OperationalSeriesRow[]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Failed to load weekly slots");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope.region, scope.city, weekOffset]);

  useEffect(() => {
    void load();
  }, [load]);

  const queueRows = useMemo(() => {
    return rows.map((row) => {
      const check = checkSeriesDateStamp({
        series: {
          dayOfWeek: row.dayOfWeek,
          startTimeHour: row.startTimeHour,
          startTimeMinute: row.startTimeMinute,
          meetUpPoint: row.meetUpPoint,
          description: row.description,
        },
        weekRunId: row.weekRun?.id ?? null,
        latestPriorRunId: row.latestPriorRun?.id ?? null,
      });
      return { row, check };
    });
  }, [rows]);

  const handleReuseLastRun = async (row: OperationalSeriesRow) => {
    const targetDateYmd = row.weekSlotYmd?.trim();
    if (!targetDateYmd) return;
    setActingSeriesId(row.seriesId);
    setError(null);
    try {
      const res = await runmanageApi.post(
        `/api/runmanage/run-series/${encodeURIComponent(row.seriesId)}/advance-slot`,
        { targetDateYmd }
      );
      if (!res.data?.success) {
        setError(res.data?.error || "Could not reuse last run");
        return;
      }
      const runId = res.data.runId as string | undefined;
      if (runId) {
        globalThis.location.href = scoped(`/runmanage/runs/${runId}?mode=edit`);
        return;
      }
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Could not reuse last run");
    } finally {
      setActingSeriesId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Weekly club slots</h2>
          <p className="mt-1 text-sm text-gray-600">
            Each recurring slot for this week — open the run, reuse the last one, or build the first.
          </p>
          {weekWindow ? (
            <p className="mt-1 text-xs text-gray-500">
              Week {weekWindow.startYmd} – {weekWindow.endYmd}
              {scope.region || scope.city ? (
                <>
                  {" · "}
                  {[scope.region, scope.city].filter(Boolean).join(" / ")}
                </>
              ) : (
                " · all metros (use scope bar to narrow)"
              )}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading slots…
        </div>
      ) : queueRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
          No club series in this view.{" "}
          <Link href={scoped(RUN_MANAGE_SERIES_PATH)} className="font-medium text-sky-700 hover:underline">
            Add or edit series
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-2">Slot</th>
                <th className="px-3 py-2">Club</th>
                <th className="px-3 py-2">Time / meet-up</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queueRows.map(({ row, check }) => {
                const label = seriesDateStampLabel(check.kind);
                const slotDate = row.weekSlotYmd ?? "—";
                const buildHref = scoped(
                  runManageCreateFromSeriesPath(row.seriesId, {
                    dateYmd: row.weekSlotYmd ?? row.suggestedBuildDateYmd,
                  })
                );
                const openHref =
                  row.weekRun?.id != null
                    ? scoped(`/runmanage/runs/${row.weekRun.id}?mode=edit`)
                    : null;

                return (
                  <tr key={row.seriesId} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">
                        {row.dayOfWeek}
                        {row.name ? ` · ${row.name}` : ""}
                      </div>
                      <div className="text-xs text-gray-500">{slotDate}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-800">{row.clubName ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700">
                      <div>{formatTime(row.startTimeHour, row.startTimeMinute, row.startTimePeriod)}</div>
                      <div className="text-xs text-gray-500">{row.meetUpPoint ?? "No meet-up"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${kindBadgeClass(check.kind)}`}
                      >
                        {label}
                      </span>
                      {check.kind === "stamp_incomplete" ? (
                        <p className="mt-1 text-xs text-gray-600">
                          Missing: {check.missingStampFields.join(", ")}
                        </p>
                      ) : null}
                      {check.missingDescription && check.kind !== "stamp_incomplete" ? (
                        <p className="mt-1 text-xs text-amber-800">Description empty</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {check.kind === "open" && openHref ? (
                        <Link
                          href={openHref}
                          className="inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                          Open
                        </Link>
                      ) : null}
                      {check.kind === "reuse_last_run" ? (
                        <button
                          type="button"
                          disabled={actingSeriesId === row.seriesId}
                          onClick={() => void handleReuseLastRun(row)}
                          className="inline-flex rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          {actingSeriesId === row.seriesId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Reuse last run"
                          )}
                        </button>
                      ) : null}
                      {check.kind === "build_first_run" ? (
                        <Link
                          href={buildHref}
                          className="inline-flex rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                        >
                          Build this run instance
                        </Link>
                      ) : null}
                      {check.kind === "stamp_incomplete" ? (
                        <Link
                          href={scoped(`${RUN_MANAGE_SERIES_PATH}?edit=${encodeURIComponent(row.seriesId)}`)}
                          className="inline-flex rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                        >
                          Edit series
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
