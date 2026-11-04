"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { RunManageOperationalSeriesTable } from "@/components/runmanage/RunManageOperationalSeriesTable";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import type { OperationalSeriesRow } from "@/lib/runmanage/series-operational-list";

const WEEKDAY_FILTER_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

function normalizeCity(city: string | null | undefined): string {
  return (city ?? "").trim();
}

export default function RunManageSeriesList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OperationalSeriesRow[]>([]);

  const cityFilter = searchParams.get("city")?.trim() ?? "";
  const clubFilter = searchParams.get("clubId")?.trim() ?? "";
  const [dayFilter, setDayFilter] = useState("");
  const [stoplightFilter, setStoplightFilter] = useState<"all" | "needs_build" | "ready">("all");

  const setUrlFilters = useCallback(
    (next: { city?: string; clubId?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.city !== undefined) {
        if (next.city) params.set("city", next.city);
        else params.delete("city");
      }
      if (next.clubId !== undefined) {
        if (next.clubId) params.set("clubId", next.clubId);
        else params.delete("clubId");
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

  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    for (const r of rows) {
      const c = normalizeCity(r.clubCity);
      if (c) cities.add(c);
    }
    return [...cities].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const clubOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.runClubId) continue;
      if (cityFilter && normalizeCity(r.clubCity) !== cityFilter) continue;
      map.set(r.runClubId, r.clubName?.trim() || "Club");
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, cityFilter]);

  useEffect(() => {
    if (!clubFilter) return;
    const stillValid = clubOptions.some((c) => c.id === clubFilter);
    if (!stillValid) setUrlFilters({ clubId: "" });
  }, [clubFilter, clubOptions, setUrlFilters]);

  const dayOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.dayOfWeek.trim().toUpperCase()));
    return WEEKDAY_FILTER_ORDER.filter((d) => present.has(d));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (cityFilter && normalizeCity(r.clubCity) !== cityFilter) return false;
      if (clubFilter && r.runClubId !== clubFilter) return false;
      if (dayFilter && r.dayOfWeek.trim().toUpperCase() !== dayFilter) return false;
      if (stoplightFilter === "ready" && r.stoplight !== "ready") return false;
      if (stoplightFilter === "needs_build" && r.stoplight === "ready") return false;
      return true;
    });
  }, [rows, cityFilter, clubFilter, dayFilter, stoplightFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Weekly slots</p>
          <h1 className="text-2xl font-bold text-gray-900">Recurring runs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Pick a city and club, then build the next dated run for each slot.
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">City</span>
          <select
            value={cityFilter}
            onChange={(e) => {
              const city = e.target.value;
              setUrlFilters({ city, clubId: "" });
            }}
            className="mt-1 block min-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Club</span>
          <select
            value={clubFilter}
            onChange={(e) => setUrlFilters({ clubId: e.target.value })}
            disabled={clubOptions.length === 0}
            className="mt-1 block min-w-[240px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-50"
          >
            <option value="">All clubs{cityFilter ? " in city" : ""}</option>
            {clubOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Day</span>
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="mt-1 block min-w-[160px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All days</option>
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {formatDayLabel(d)}
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
