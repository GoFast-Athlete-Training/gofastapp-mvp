"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2, Pencil, Plus } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import type { SeriesManageRow } from "@/lib/runmanage/series-manage-list";
import { RunManageSeriesMetaForm } from "@/components/runmanage/RunManageSeriesMetaForm";

export default function RunManageSeriesList() {
  const searchParams = useSearchParams();
  const regionFilter = searchParams.get("region")?.trim() ?? "";
  const cityFilter = searchParams.get("city")?.trim() ?? "";
  const clubFilter = searchParams.get("clubId")?.trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SeriesManageRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<SeriesManageRow | null>(null);

  const load = useCallback(async () => {
    const clubOnly = Boolean(clubFilter && !regionFilter && !cityFilter);
    if (!clubOnly && (!regionFilter || !cityFilter)) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view: "manage" });
      if (clubOnly) {
        params.set("clubId", clubFilter);
      } else {
        params.set("region", regionFilter);
        params.set("city", cityFilter);
        if (clubFilter) params.set("clubId", clubFilter);
      }
      const res = await runmanageApi.get(`/api/runmanage/run-series?${params.toString()}`);
      if (!res.data?.success) {
        setError(res.data?.error || "Failed to load series");
        setRows([]);
        return;
      }
      setRows((res.data.manageSeries ?? []) as SeriesManageRow[]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Failed to load series");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [regionFilter, cityFilter, clubFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const focusSeriesId =
    searchParams.get("series")?.trim() ?? searchParams.get("edit")?.trim() ?? "";

  useEffect(() => {
    if (!focusSeriesId || rows.length === 0) return;
    const match = rows.find((r) => r.id === focusSeriesId);
    if (match) {
      setEditRow(match);
      setFormOpen(true);
    }
  }, [focusSeriesId, rows]);

  const clubScoped = Boolean(clubFilter && !regionFilter && !cityFilter);
  const filtersReady = clubScoped || Boolean(regionFilter && cityFilter);

  function formatTime(row: SeriesManageRow): string {
    if (row.startTimeHour == null) return "—";
    const min = String(row.startTimeMinute ?? 0).padStart(2, "0");
    const p = row.startTimePeriod?.trim() || "";
    return `${row.startTimeHour}:${min}${p ? ` ${p}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Recurring</p>
          <h1 className="text-2xl font-bold text-gray-900">Series</h1>
          <p className="mt-1 text-sm text-gray-600">
            Define each weekly slot — day, time, and meet-up. Dated runs advance from the last run,
            not from this form.
          </p>
        </div>
        <button
          type="button"
          disabled={!filtersReady}
          onClick={() => {
            setEditRow(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New series
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {!filtersReady ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-950">
          Select a region and city in the scope bar above, or open this page from a run with a club in the URL.
        </p>
      ) : loading ? (
        <div className="flex items-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading series…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center text-sm text-gray-500">
          No weekly series in this city yet.{" "}
          <button
            type="button"
            className="font-medium text-sky-700 hover:underline"
            onClick={() => {
              setEditRow(null);
              setFormOpen(true);
            }}
          >
            Add one
          </button>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Day & time</th>
                <th className="px-4 py-3">Series</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Meet-up</th>
                <th className="px-4 py-3 text-right">Runs</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                    {formatDayLabel(row.dayOfWeek)} · {formatTime(row)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.name?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.clubName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {row.meetUpPoint?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.runCount}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditRow(row);
                        setFormOpen(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        To build or validate this week&apos;s dated runs, use{" "}
        <Link href="/runmanage/runs" className="font-medium text-sky-700 hover:underline">
          This week
        </Link>
        .
      </p>

      <RunManageSeriesMetaForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditRow(null);
        }}
        onSaved={() => void load()}
        citySlug={cityFilter}
        initial={editRow}
      />
    </div>
  );
}
