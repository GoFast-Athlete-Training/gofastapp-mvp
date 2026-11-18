"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import type { SeriesManageRow } from "@/lib/runmanage/series-manage-list";
import { RunManageSeriesDayList } from "@/components/runmanage/RunManageSeriesDayList";
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
    const clubOnly = Boolean(clubFilter && !regionFilter);
    if (!clubOnly && !regionFilter) {
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
        if (cityFilter) params.set("city", cityFilter);
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

  const clubScoped = Boolean(clubFilter && !regionFilter);
  const filtersReady = clubScoped || Boolean(regionFilter);

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
          Select a region in the scope bar above, or open this page from a run with a club in the URL.
        </p>
      ) : loading ? (
        <div className="flex items-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading series…
        </div>
      ) : (
        <RunManageSeriesDayList
          rows={rows}
          onEdit={(row) => {
            setEditRow(row);
            setFormOpen(true);
          }}
        />
      )}

      <p className="text-xs text-gray-500">
        To build or validate this week&apos;s dated runs, use{" "}
        <Link href="/runmanage/this-week" className="font-medium text-sky-700 hover:underline">
          Manage this week&apos;s runs
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
