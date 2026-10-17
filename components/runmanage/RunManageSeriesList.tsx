"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Loader2, RefreshCw, Trash2 } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import {
  runInstanceEditPath,
  runManageCreateFromSeriesPath,
  RUN_MANAGE_SERIES_PATH,
} from "@/lib/runmanage/paths";
import type { OperationalSeriesRow, SeriesStoplight } from "@/lib/runmanage/series-operational-list";

function formatSeriesTime(row: OperationalSeriesRow): string {
  if (row.startTimeHour == null) return "";
  const min = String(row.startTimeMinute ?? 0).padStart(2, "0");
  const p = row.startTimePeriod?.trim() || "";
  return `${row.startTimeHour}:${min}${p ? ` ${p}` : ""}`;
}

function formatRunDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function StoplightBadge({ status }: { status: SeriesStoplight }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
        <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
        Next run built
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
      <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
      {status === "build_first" ? "Build first run" : "Build next run"}
    </span>
  );
}

export default function RunManageSeriesList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OperationalSeriesRow[]>([]);
  const [clubFilter, setClubFilter] = useState("");
  const [stoplightFilter, setStoplightFilter] = useState<"all" | "needs_build" | "ready">("all");
  const [purging, setPurging] = useState(false);
  const [purgeNote, setPurgeNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runmanageApi.get("/api/runmanage/run-series");
      if (!res.data?.success) {
        setError(res.data?.error || "Failed to load series");
        setRows([]);
        return;
      }
      setRows((res.data.series ?? []) as OperationalSeriesRow[]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Failed to load series");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clubOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.runClubId && r.clubName) map.set(r.runClubId, r.clubName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (clubFilter && r.runClubId !== clubFilter) return false;
      if (stoplightFilter === "ready" && r.stoplight !== "ready") return false;
      if (stoplightFilter === "needs_build" && r.stoplight === "ready") return false;
      return true;
    });
  }, [rows, clubFilter, stoplightFilter]);

  const needsBuildCount = useMemo(
    () => rows.filter((r) => r.stoplight !== "ready").length,
    [rows]
  );

  const handlePurgeUnclaimed = async (dryRun: boolean) => {
    if (
      !dryRun &&
      !confirm(
        "Delete all unpublished club runs with zero RSVPs? Series and clubs stay. This cannot be undone."
      )
    ) {
      return;
    }
    setPurging(true);
    setPurgeNote(null);
    try {
      const res = await runmanageApi.post("/api/runmanage/runs/purge-unclaimed", {
        confirm: "PURGE_UNCLAIMED_RUNS",
        dryRun,
        runClubId: clubFilter || undefined,
      });
      if (!res.data?.success) {
        alert(res.data?.error || "Purge failed");
        return;
      }
      const eligible = Number(res.data.eligible ?? 0);
      const deleted = Number(res.data.deleted ?? 0);
      setPurgeNote(
        dryRun
          ? `${eligible} unclaimed draft run(s) would be deleted${clubFilter ? " for this club" : ""}.`
          : `Deleted ${deleted} unclaimed draft run(s).`
      );
      if (!dryRun) await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      alert(err.response?.data?.error || err.message || "Purge failed");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Run series</p>
          <h1 className="text-2xl font-bold text-gray-900">Weekly slots</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Every recurring series in one list. Club is a label — open the next dated run or build
            the missing week from the series template.
          </p>
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

      {needsBuildCount > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>{needsBuildCount}</strong> series need a dated run built — auto-advance is off.
          Use <strong>Build next run</strong> on each row.
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Club</span>
          <select
            value={clubFilter}
            onChange={(e) => setClubFilter(e.target.value)}
            className="mt-1 block min-w-[200px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All clubs</option>
            {clubOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Stoplight</span>
          <select
            value={stoplightFilter}
            onChange={(e) =>
              setStoplightFilter(e.target.value as "all" | "needs_build" | "ready")
            }
            className="mt-1 block min-w-[160px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="needs_build">Needs build</option>
            <option value="ready">Next run built</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-700">
            Clear stale unpublished instances (no RSVPs). Series and clubs are not deleted.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={purging}
              onClick={() => void handlePurgeUnclaimed(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Preview purge
            </button>
            <button
              type="button"
              disabled={purging}
              onClick={() => void handlePurgeUnclaimed(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 disabled:opacity-50"
            >
              {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Purge unclaimed runs
            </button>
          </div>
        </div>
        {purgeNote ? <p className="mt-2 text-xs text-gray-600">{purgeNote}</p> : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading series…
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No series match these filters.</p>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {filtered.map((row) => {
            const time = formatSeriesTime(row);
            const buildHref = runManageCreateFromSeriesPath(row.seriesId, {
              dateYmd: row.suggestedBuildDateYmd,
            });
            return (
              <li key={row.seriesId} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StoplightBadge status={row.stoplight} />
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDayLabel(row.dayOfWeek)}
                        {time ? ` · ${time}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-800">
                      {row.clubName ?? "Unknown club"}
                      {row.clubCity ? ` · ${row.clubCity}` : ""}
                    </p>
                    {row.name?.trim() && row.name.trim().toLowerCase() !== row.dayOfWeek.toLowerCase() ? (
                      <p className="text-xs text-gray-600">{row.name}</p>
                    ) : null}
                    {row.meetUpPoint ? (
                      <p className="mt-1 truncate text-xs text-gray-500">{row.meetUpPoint}</p>
                    ) : null}
                    {row.stoplight !== "ready" && row.suggestedBuildDateYmd ? (
                      <p className="mt-2 text-xs text-amber-900">
                        Target date:{" "}
                        <strong>{row.suggestedBuildDateYmd}</strong>
                        {row.latestPriorRun ? (
                          <>
                            {" "}
                            · after {formatRunDate(row.latestPriorRun.date)}
                          </>
                        ) : null}
                      </p>
                    ) : null}
                    {row.nextRun ? (
                      <p className="mt-2 text-xs text-emerald-900">
                        Upcoming: <strong>{row.nextRun.title}</strong> ·{" "}
                        {formatRunDate(row.nextRun.date)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                    <Link
                      href={`${RUN_MANAGE_SERIES_PATH}?series=${encodeURIComponent(row.seriesId)}`}
                      className="text-xs font-medium text-sky-800 hover:underline"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
