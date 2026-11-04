"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { RunManageWeekDayBoard } from "@/components/runmanage/RunManageWeekDayBoard";
import type { OperationalSeriesRow } from "@/lib/runmanage/series-operational-list";
import type { WeekWindow } from "@/lib/runmanage/calendar-week";

export default function RunManageSeriesList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OperationalSeriesRow[]>([]);
  const [window, setWindow] = useState<WeekWindow | null>(null);

  const regionFilter = searchParams.get("region")?.trim() ?? "";
  const cityFilter = searchParams.get("city")?.trim() ?? "";
  const clubFilter = searchParams.get("clubId")?.trim() ?? "";
  const weekOffset = parseInt(searchParams.get("weekOffset") ?? "0", 10) || 0;

  const setUrlFilters = useCallback(
    (next: { clubId?: string; weekOffset?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.clubId !== undefined) {
        if (next.clubId) params.set("clubId", next.clubId);
        else params.delete("clubId");
      }
      if (next.weekOffset !== undefined) {
        if (next.weekOffset === 0) params.delete("weekOffset");
        else params.set("weekOffset", String(next.weekOffset));
      }
      const q = params.toString();
      router.replace(q ? `/runmanage/series?${q}` : "/runmanage/series", { scroll: false });
    },
    [router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (regionFilter) params.set("region", regionFilter);
      if (cityFilter) params.set("city", cityFilter);
      if (clubFilter) params.set("clubId", clubFilter);
      if (weekOffset) params.set("weekOffset", String(weekOffset));
      const res = await runmanageApi.get(`/api/runmanage/run-series?${params.toString()}`);
      if (!res.data?.success) {
        setError(res.data?.error || "Failed to load series");
        setRows([]);
        return;
      }
      setWindow(res.data.window ?? null);
      let series = (res.data.series ?? []) as OperationalSeriesRow[];
      if (clubFilter) {
        series = series.filter((r) => r.runClubId === clubFilter);
      }
      setRows(series);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Failed to load series");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [regionFilter, cityFilter, clubFilter, weekOffset]);

  useEffect(() => {
    void load();
  }, [load]);

  const clubOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.runClubId) continue;
      map.set(r.runClubId, r.clubName?.trim() || "Club");
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtersReady = Boolean(regionFilter && cityFilter);

  const handlePrepareWeek = async () => {
    if (!regionFilter || !cityFilter) return;
    setPreparing(true);
    setError(null);
    try {
      const res = await runmanageApi.post("/api/runmanage/prepare-week", {
        regionSlug: regionFilter,
        citySlug: cityFilter,
        weekOffset,
      });
      if (!res.data?.success) {
        setError(res.data?.error || "Prepare failed");
        return;
      }
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Prepare failed");
    } finally {
      setPreparing(false);
    }
  };

  const summary = useMemo(() => {
    return {
      total: rows.length,
      needsValidate: rows.filter((r) => r.stoplight === "needs_validate").length,
      needsPrepare: rows.filter((r) => r.stoplight === "needs_prepare").length,
      ready: rows.filter((r) => r.stoplight === "ready").length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">This week</p>
          <h1 className="text-2xl font-bold text-gray-900">Weekly validate board</h1>
          <p className="mt-1 text-sm text-gray-600">
            Region and city are set in the bar above. Prepare slots from last run, then validate date,
            time, and meet-up.
          </p>
          {window ? (
            <p className="mt-1 text-xs text-gray-500">
              Week {window.startYmd} – {window.endYmd}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUrlFilters({ weekOffset: weekOffset - 1 })}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Previous week
          </button>
          <button
            type="button"
            onClick={() => setUrlFilters({ weekOffset: weekOffset + 1 })}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Next week
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handlePrepareWeek()}
            disabled={!filtersReady || preparing}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Prepare this week
          </button>
        </div>
      </div>

      {filtersReady ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Club</span>
            <select
              value={clubFilter}
              onChange={(e) => setUrlFilters({ clubId: e.target.value })}
              disabled={clubOptions.length === 0}
              className="mt-1 block min-w-[240px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-50"
            >
              <option value="">All clubs in city</option>
              {clubOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {filtersReady && !loading ? (
        <p className="text-sm text-gray-600">
          {summary.total} slots · {summary.ready} validated · {summary.needsValidate} need validate ·{" "}
          {summary.needsPrepare} need prepare
        </p>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {!regionFilter ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-950">
          Select a region in the scope bar above.
        </p>
      ) : !cityFilter ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-950">
          Select a city in the scope bar to load this week&apos;s slots.
        </p>
      ) : loading ? (
        <div className="flex items-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading this week…
        </div>
      ) : (
        <RunManageWeekDayBoard rows={rows} onRowsChange={setRows} />
      )}
    </div>
  );
}
