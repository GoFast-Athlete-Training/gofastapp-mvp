"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronLeft, Edit, Eye, Loader2, MapPin, Trash2 } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import {
  COCKPIT_BUCKET_META,
  cockpitBucketForRun,
  type CockpitBucket,
} from "@/lib/runmanage/run-cockpit-buckets";

interface RunClub {
  id: string;
  name: string;
}

interface RunRow {
  id: string;
  title: string;
  date: string;
  meetUpPoint: string;
  meetUpCity: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  workflowStatus?: string;
  runClub: RunClub | null;
  runClubId?: string | null;
  cityRunType?: string | null;
  runBrandId?: string | null;
  runStoreId?: string | null;
  athleteGeneratedId?: string | null;
  rsvpCount?: number;
}

function formatRunDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(hour: number | null, minute: number | null, period: string | null) {
  if (hour === null || minute === null) return "";
  const minStr = minute.toString().padStart(2, "0");
  return `${hour}:${minStr} ${period || "AM"}`;
}

function workflowBadgeClass(status: string) {
  if (status === "APPROVED") return "bg-green-100 text-green-700";
  if (status === "SUBMITTED") return "bg-blue-50 text-blue-800";
  if (status === "PENDING") return "bg-yellow-50 text-yellow-800";
  return "bg-gray-100 text-gray-700";
}

function ownerLabel(run: RunRow, bucket: CockpitBucket | null): string {
  if (run.runClub?.name) return run.runClub.name;
  const b = bucket ?? cockpitBucketForRun(run);
  if (b === "individual") return "Athlete";
  if (b === "run_store") return "Store";
  return "—";
}

type RunManageInstanceListProps = {
  /** When set, only instances in this type lane. Omit for all runs. */
  bucket?: CockpitBucket;
  backHref?: string;
  backLabel?: string;
};

export function RunManageInstanceList({ bucket, backHref, backLabel }: RunManageInstanceListProps) {
  const typeMeta = bucket ? COCKPIT_BUCKET_META[bucket] : null;
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ upcomingOnly: "false" });
      const response = await runmanageApi.get(`/api/runs/manage?${params.toString()}`);
      if (response.data.success) {
        const all = (response.data.runs || []) as RunRow[];
        setRuns(bucket ? all.filter((r) => cockpitBucketForRun(r) === bucket) : all);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [bucket]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...runs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [runs]
  );

  const allSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    const label = ids.length === 1 ? "this run" : `${ids.length} runs`;
    if (!confirm(`Delete ${label}? RSVPs on those runs are removed. This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await runmanageApi.post("/api/runs/manage/bulk-delete", { runIds: ids });
      if (!res.data?.success) {
        alert(res.data?.error || "Delete failed");
        return;
      }
      setSelected(new Set());
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      alert(err.response?.data?.error || err.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-800 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel ?? "Back"}
        </Link>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
          {bucket ? "Run type" : "All runs"}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          {typeMeta?.label ?? "Every instance"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {typeMeta?.description ??
            "Full history across types — select rows to bulk delete or edit one at a time."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            disabled={loading || sorted.length === 0}
            className="rounded border-gray-300"
          />
          Select all ({sorted.length})
        </label>
        {selected.size > 0 ? (
          <button
            type="button"
            disabled={deleting}
            onClick={() => void deleteIds([...selected])}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete selected ({selected.size})
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading runs…
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center text-sm text-gray-500">
          {bucket ? "No instances in this lane yet." : "No runs yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="px-4 py-3">Date & time</th>
                <th className="px-4 py-3">Title</th>
                {!bucket ? <th className="px-4 py-3">Type</th> : null}
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((run) => {
                const status = (run.workflowStatus || "DEVELOP").toUpperCase();
                const runBucket = cockpitBucketForRun(run);
                const typeLabel = runBucket ? COCKPIT_BUCKET_META[runBucket].label : "Other";
                return (
                  <tr key={run.id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(run.id)}
                        onChange={() => toggleOne(run.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {formatRunDate(run.date)}
                      </span>
                      <div className="text-xs text-gray-500">
                        {formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{run.title}</td>
                    {!bucket ? (
                      <td className="px-4 py-3 text-gray-600">{typeLabel}</td>
                    ) : null}
                    <td className="max-w-[12rem] truncate px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {run.meetUpPoint}
                        {run.meetUpCity ? `, ${run.meetUpCity}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{ownerLabel(run, bucket ?? null)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${workflowBadgeClass(status)}`}
                      >
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </span>
                      {(run.rsvpCount ?? 0) > 0 ? (
                        <div className="mt-0.5 text-xs text-gray-500">{run.rsvpCount} RSVPs</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        <Link
                          href={`/runmanage/runs/${run.id}?mode=view`}
                          className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/runmanage/runs/${run.id}?mode=edit`}
                          className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => void deleteIds([run.id])}
                          className="rounded-md border border-red-200 p-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** @deprecated use RunManageInstanceList with bucket */
export function RunManageTypeInstanceList({ bucket }: { bucket: CockpitBucket }) {
  return (
    <RunManageInstanceList
      bucket={bucket}
      backHref="/runmanage/runs"
      backLabel="Dashboard"
    />
  );
}
