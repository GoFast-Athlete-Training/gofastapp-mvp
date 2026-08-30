"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { onAuthStateChanged } from "firebase/auth";
import api from "@/lib/api";
import type { PaceForPaceStatus } from "@/lib/training/pace-for-pace-status";
import { paceForPaceStatusLabel } from "@/lib/training/pace-for-pace-status";

type HistoryItem = {
  id: string;
  activityId: string | null;
  title: string;
  workoutType: string;
  planName: string | null;
  date: string | null;
  activityName: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  avgPaceSecPerMile: number | null;
  avgHeartRate: number | null;
  plannedDistanceMeters: number | null;
  paceDeltaSecPerMile: number | null;
  segmentExecutionStatus: string | null;
  executionHeadline: string | null;
  paceForPaceStatus: PaceForPaceStatus;
  paceForPaceStatusLabel: string;
  paceForPaceMessage: string | null;
  priorSameTypePaceDeltaSecPerMile: number | null;
};

function formatSecPerMile(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
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

function statusBadgeClass(status: PaceForPaceStatus): string {
  switch (status) {
    case "PACE_FOR_PACE_AVAILABLE":
      return "bg-emerald-100 text-emerald-900";
    case "PACE_FOR_PACE_FAILED":
      return "bg-red-100 text-red-900";
    case "UNMATCHED":
      return "bg-amber-100 text-amber-900";
    case "MATCHED_ANALYSIS_NOT_GENERATED":
      return "bg-sky-100 text-sky-900";
    case "NO_STRUCTURED_PACE_TARGETS":
      return "bg-neutral-100 text-neutral-700";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

export default function PerformancePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Performance</h1>
              <p className="text-gray-600 leading-relaxed max-w-3xl">
                Inspect recent completed workouts, Pace for Pace state, and re-run analysis on
                historical activities without needing a new run. For today&apos;s plan, open{" "}
                <Link href="/training" className="font-medium text-orange-600 hover:text-orange-700">
                  Train
                </Link>
                .
              </p>
            </div>
            <PerformanceHistoryTable />
          </div>
        </main>
      </div>
    </div>
  );
}

function PerformanceHistoryTable() {
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRowError(null);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch("/api/performance/history?limit=50", {
        headers: athleteBearerFetchHeaders(token),
      });
      const json = (await res.json()) as { items?: HistoryItem[] };
      if (res.ok && Array.isArray(json.items)) {
        setItems(json.items);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
      if (!user) setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  const handleRerun = async (item: HistoryItem) => {
    setRerunningId(item.id);
    setRowError(null);
    try {
      const res = await api.post<{
        ok: boolean;
        message?: string;
        paceForPaceStatus?: PaceForPaceStatus;
      }>("/training/pace-for-pace", {
        workoutId: item.id,
        activityId: item.activityId ?? undefined,
      });
      if (!res.data?.ok) {
        setRowError(res.data?.message ?? "Pace for Pace failed.");
      }
      await load();
    } catch (e: unknown) {
      setRowError(e instanceof Error ? e.message : "Pace for Pace failed.");
    } finally {
      setRerunningId(null);
    }
  };

  if (!authReady) {
    return <p className="text-sm text-gray-500">Checking your session…</p>;
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading performance history…</p>;
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-600">
          No matched workouts yet. After Garmin sync and a completed planned workout, rows appear
          here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {rowError ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {rowError}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Workout</th>
              <th className="px-4 py-3 font-semibold">Actual</th>
              <th className="px-4 py-3 font-semibold">Pace for Pace</th>
              <th className="px-4 py-3 font-semibold">Execution</th>
              <th className="px-4 py-3 font-semibold">Trend</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 align-top">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                  {formatDate(item.date)}
                </td>
                <td className="px-4 py-3 min-w-[12rem]">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.workoutType}</p>
                  {item.planName ? (
                    <p className="text-xs text-gray-500">{item.planName}</p>
                  ) : null}
                  {item.activityName ? (
                    <p className="mt-1 text-xs text-gray-600">{item.activityName}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-700">
                  <div>
                    {item.distanceMeters != null
                      ? `${(item.distanceMeters / 1609.34).toFixed(2)} mi`
                      : "—"}
                  </div>
                  <div>{formatSecPerMile(item.avgPaceSecPerMile)}</div>
                  <div>
                    {item.durationSeconds != null
                      ? `${Math.round(item.durationSeconds / 60)} min`
                      : "—"}
                  </div>
                  <div>{item.avgHeartRate != null ? `${item.avgHeartRate} bpm` : "—"}</div>
                </td>
                <td className="px-4 py-3 min-w-[10rem]">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.paceForPaceStatus)}`}
                  >
                    {item.paceForPaceStatusLabel ||
                      paceForPaceStatusLabel(item.paceForPaceStatus)}
                  </span>
                  {item.paceForPaceMessage ? (
                    <p className="mt-2 text-xs text-gray-600">{item.paceForPaceMessage}</p>
                  ) : null}
                  {item.segmentExecutionStatus ? (
                    <p className="mt-1 text-xs text-gray-500">{item.segmentExecutionStatus}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {item.executionHeadline ?? "—"}
                  {item.paceDeltaSecPerMile != null ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Δ {item.paceDeltaSecPerMile > 0 ? "+" : ""}
                      {item.paceDeltaSecPerMile} sec/mi
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {item.priorSameTypePaceDeltaSecPerMile != null ? (
                    <span className="text-xs tabular-nums">
                      prev {item.workoutType}: {item.priorSameTypePaceDeltaSecPerMile > 0 ? "+" : ""}
                      {item.priorSameTypePaceDeltaSecPerMile} sec/mi
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/workouts/${item.id}`}
                      className="text-orange-600 hover:text-orange-700 font-semibold"
                    >
                      Open
                    </Link>
                    {item.paceForPaceStatus !== "PACE_FOR_PACE_AVAILABLE" ? (
                      <button
                        type="button"
                        disabled={rerunningId === item.id}
                        onClick={() => void handleRerun(item)}
                        className="text-left text-violet-700 hover:text-violet-900 font-semibold disabled:opacity-50"
                      >
                        {rerunningId === item.id ? "Running…" : "Re-run Pace for Pace"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
