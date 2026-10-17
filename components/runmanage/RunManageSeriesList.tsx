"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { RunManageOperationalSeriesTable } from "@/components/runmanage/RunManageOperationalSeriesTable";
import type { OperationalSeriesRow } from "@/lib/runmanage/series-operational-list";

export default function RunManageSeriesList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OperationalSeriesRow[]>([]);
  const [clubFilter, setClubFilter] = useState("");
  const [stoplightFilter, setStoplightFilter] = useState<"all" | "needs_build" | "ready">("all");

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">All series</p>
          <h1 className="text-2xl font-bold text-gray-900">Weekly slots</h1>
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
      ) : (
        <RunManageOperationalSeriesTable rows={filtered} />
      )}
    </div>
  );
}
