"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, Loader2 } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { RunManageOperationalSeriesTable } from "@/components/runmanage/RunManageOperationalSeriesTable";
import { RUN_MANAGE_CLUBS_PATH } from "@/lib/runmanage/paths";
import type { OperationalSeriesRow } from "@/lib/runmanage/series-operational-list";

export function RunManageClubHub({ clubId }: { clubId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [rows, setRows] = useState<OperationalSeriesRow[]>([]);
  const [stoplightFilter, setStoplightFilter] = useState<"all" | "needs_build" | "ready">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clubRes, seriesRes] = await Promise.all([
        runmanageApi.get(`/api/runmanage/run-clubs/${encodeURIComponent(clubId)}`),
        runmanageApi.get(
          `/api/runmanage/run-series?runClubId=${encodeURIComponent(clubId)}`
        ),
      ]);
      if (clubRes.data?.success && clubRes.data.runClub) {
        setClubName(clubRes.data.runClub.name ?? null);
      }
      if (!seriesRes.data?.success) {
        setError(seriesRes.data?.error || "Failed to load series");
        setRows([]);
        return;
      }
      setRows((seriesRes.data.series ?? []) as OperationalSeriesRow[]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Failed to load club hub");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (stoplightFilter === "ready" && r.stoplight !== "ready") return false;
      if (stoplightFilter === "needs_build" && r.stoplight === "ready") return false;
      return true;
    });
  }, [rows, stoplightFilter]);

  return (
    <div className="space-y-6">
      <Link
        href={RUN_MANAGE_CLUBS_PATH}
        className="inline-flex items-center gap-1 text-sm font-medium text-sky-800 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Build by clubs
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Club run hub</p>
        <h1 className="text-2xl font-bold text-gray-900">{clubName ?? "Club"}</h1>
      </div>

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
