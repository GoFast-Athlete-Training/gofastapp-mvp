"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronRight,
  Edit,
  Eye,
  MapPin,
  Play,
  Plus,
  Users,
} from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { runManageCreatePath } from "@/lib/runmanage/paths";

interface RunClub {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
}

interface Run {
  id: string;
  title: string;
  citySlug: string;
  meetUpPoint: string;
  meetUpCity: string | null;
  meetUpState: string | null;
  date: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  workflowStatus?: string;
  runClub: RunClub | null;
  rsvpCount?: number;
  stravaMapUrl?: string | null;
  totalMiles?: number | null;
}

function getRunCompletion(run: Run): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!run.title?.trim()) missing.push("Title");
  if (!run.date) missing.push("Date");
  if (run.startTimeHour == null || run.startTimeMinute == null) missing.push("Time");
  if (!run.meetUpPoint?.trim()) missing.push("Location");
  if (run.totalMiles == null || run.totalMiles === 0) missing.push("Miles");
  if (!run.stravaMapUrl?.trim()) missing.push("Strava URL");
  return { complete: missing.length === 0, missing };
}

function formatRunDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
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

type Filter = "all" | "develop" | "pending" | "submitted" | "approved";

export function RunManageDashboardHome() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const response = await runmanageApi.get("/api/runs/manage");
        if (response.data.success) {
          setRuns(response.data.runs || []);
        }
      } catch (error) {
        console.error("Error fetching runs:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => {
    const c = { all: runs.length, develop: 0, pending: 0, submitted: 0, approved: 0 };
    for (const r of runs) {
      const s = (r.workflowStatus || "DEVELOP").toUpperCase();
      if (s === "DEVELOP") c.develop++;
      else if (s === "PENDING") c.pending++;
      else if (s === "SUBMITTED") c.submitted++;
      else if (s === "APPROVED") c.approved++;
    }
    return c;
  }, [runs]);

  const submittedRuns = useMemo(
    () => runs.filter((r) => (r.workflowStatus || "").toUpperCase() === "SUBMITTED"),
    [runs]
  );

  const upcomingApproved = useMemo(() => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 14);
    end.setUTCHours(23, 59, 59, 999);
    return runs
      .filter((r) => {
        if ((r.workflowStatus || "").toUpperCase() !== "APPROVED" || !r.date) return false;
        const d = new Date(r.date);
        return d >= start && d <= end;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (filter === "all") return runs;
    const target = filter.toUpperCase();
    return runs.filter((r) => (r.workflowStatus || "DEVELOP").toUpperCase() === target);
  }, [runs, filter]);

  const handleApprove = async (runId: string) => {
    if (!confirm("Approve this run? It will be marked approved in the editorial workflow.")) {
      return;
    }
    try {
      const response = await runmanageApi.post(`/api/runs/manage/${runId}/approve`, {});
      if (response.data.success) {
        const refresh = await runmanageApi.get("/api/runs/manage");
        if (refresh.data.success) setRuns(refresh.data.runs || []);
      }
    } catch {
      alert("Failed to approve run. Please try again.");
    }
  };

  const setFilterAndScroll = (f: Filter) => {
    setFilter(f);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stageCards: {
    key: Filter;
    label: string;
    count: number;
    border: string;
    bg: string;
    icon: typeof Play;
  }[] = [
    {
      key: "develop",
      label: "Develop",
      count: counts.develop,
      border: "border-gray-200",
      bg: "bg-gray-50",
      icon: Play,
    },
    {
      key: "pending",
      label: "Pending",
      count: counts.pending,
      border: "border-yellow-200",
      bg: "bg-yellow-50/80",
      icon: Calendar,
    },
    {
      key: "submitted",
      label: "Submitted",
      count: counts.submitted,
      border: "border-orange-200",
      bg: "bg-orange-50/80",
      icon: AlertCircle,
    },
    {
      key: "approved",
      label: "Approved",
      count: counts.approved,
      border: "border-emerald-200",
      bg: "bg-emerald-50/80",
      icon: CheckCircle,
    },
    {
      key: "all",
      label: "All instances",
      count: counts.all,
      border: "border-sky-200",
      bg: "bg-sky-50/80",
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Run Manage</h1>
          <p className="mt-1 text-gray-600">Create city runs, review workflow, and approve for publish.</p>
        </div>
        <Link
          href={runManageCreatePath()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" />
          Create run
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stageCards.map((card) => {
          const Icon = card.icon;
          const active = filter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setFilterAndScroll(card.key)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${card.border} ${card.bg} ${
                active ? "ring-2 ring-sky-500 ring-offset-1" : "hover:brightness-[0.98]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 text-gray-700" />
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? "…" : card.count}</p>
            </button>
          );
        })}
      </div>

      {!loading ? (
        <>
          <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-700" />
              <h2 className="text-lg font-semibold text-amber-950">Needs action</h2>
            </div>
            <p className="mb-4 text-sm text-amber-900/80">Runs waiting for review (SUBMITTED).</p>
            {submittedRuns.length === 0 ? (
              <p className="text-sm text-gray-600">Nothing queued right now.</p>
            ) : (
              <ul className="divide-y divide-amber-200/80 overflow-hidden rounded-lg border border-amber-200/60 bg-white">
                {submittedRuns.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/runmanage/runs/${r.id}?mode=edit`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-amber-50/80"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{r.title}</p>
                        <p className="text-xs text-gray-600">
                          {formatRunDate(r.date)}
                          {r.runClub?.name ? ` · ${r.runClub.name}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-amber-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-emerald-950">Upcoming runs (14 days)</h2>
            </div>
            {upcomingApproved.length === 0 ? (
              <p className="text-sm text-gray-600">No approved runs in this window.</p>
            ) : (
              <ul className="divide-y divide-emerald-200/80 overflow-hidden rounded-lg border border-emerald-200/60 bg-white">
                {upcomingApproved.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/runmanage/runs/${r.id}?mode=view`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-emerald-50/80"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{r.title}</p>
                        <p className="text-xs text-gray-600">
                          {formatRunDate(r.date)}
                          {r.runClub?.name ? ` · ${r.runClub.name}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-emerald-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <div ref={listRef}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900">All run instances</h2>
          <div className="flex flex-wrap gap-2">
            {(["all", "develop", "pending", "submitted", "approved"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-sm capitalize ${
                  filter === f
                    ? "bg-sky-600 text-white"
                    : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading runs…</p>
        ) : filteredRuns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            No runs match this filter.{" "}
            <Link href={runManageCreatePath()} className="font-medium text-sky-700 hover:underline">
              Create a run
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {filteredRuns.map((run) => {
              const completion = getRunCompletion(run);
              const status = (run.workflowStatus || "DEVELOP").toUpperCase();
              const badgeColor =
                status === "APPROVED"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : status === "SUBMITTED"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : status === "PENDING"
                      ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                      : "bg-gray-100 text-gray-700 border-gray-200";
              return (
                <div
                  key={run.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{run.title}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${badgeColor}`}>
                          {status.charAt(0) + status.slice(1).toLowerCase()}
                        </span>
                        {!completion.complete ? (
                          <span className="text-xs text-amber-700">
                            Missing: {completion.missing.join(", ")}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatRunDate(run.date)} ·{" "}
                          {formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {run.meetUpPoint}
                          {run.meetUpCity ? `, ${run.meetUpCity}` : ""}
                        </span>
                        {run.runClub ? <span>{run.runClub.name}</span> : null}
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {run.rsvpCount ?? 0} RSVPs
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/runmanage/runs/${run.id}?mode=view`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4" /> View
                      </Link>
                      <Link
                        href={`/runmanage/runs/${run.id}?mode=edit`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        <Edit className="h-4 w-4" /> Edit
                      </Link>
                      {status !== "APPROVED" ? (
                        <button
                          type="button"
                          onClick={() => void handleApprove(run.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4" /> Approve
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
