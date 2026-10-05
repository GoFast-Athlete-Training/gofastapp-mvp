"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Edit,
  Eye,
  Flag,
  MapPin,
  Plus,
  Sparkles,
  Store,
  User,
  Users,
} from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { runManageCreatePath } from "@/lib/runmanage/paths";
import {
  COCKPIT_BUCKET_META,
  COCKPIT_BUCKET_ORDER,
  cockpitBucketForRun,
  type CockpitBucket,
} from "@/lib/runmanage/run-cockpit-buckets";
import {
  RunManageWeekStrip,
  startOfWeekMonday,
  ymdLocal,
} from "@/components/runmanage/RunManageWeekStrip";

interface RunClub {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
}

interface RunBrand {
  id: string;
  name: string;
  logoUrl: string | null;
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
  runClubId?: string | null;
  runBrandId?: string | null;
  runBrand?: RunBrand | null;
  cityRunType?: string | null;
  athleteGeneratedId?: string | null;
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

function dateKeyFromRun(run: Run): string {
  if (!run.date) return "";
  const d = new Date(run.date);
  return ymdLocal(d);
}

function workflowBadgeClass(status: string) {
  if (status === "APPROVED") return "bg-green-100 text-green-700 border-green-200";
  if (status === "SUBMITTED") return "bg-blue-50 text-blue-800 border-blue-200";
  if (status === "PENDING") return "bg-yellow-50 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

const BUCKET_ICONS: Record<CockpitBucket, typeof Building2> = {
  club: Building2,
  individual: User,
  shakeout: Flag,
  special: Sparkles,
  run_store: Store,
};

type Filter = "all" | "develop" | "pending" | "submitted" | "approved";

export function RunManageDashboardHome() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<CockpitBucket | null>(null);
  const [selectedDayYmd, setSelectedDayYmd] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [fullListOpen, setFullListOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const loadRuns = async () => {
    const response = await runmanageApi.get("/api/runs/manage?upcomingOnly=false");
    if (response.data.success) {
      setRuns(response.data.runs || []);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await loadRuns();
      } catch (error) {
        console.error("Error fetching runs:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const weekStart = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const weekEndExclusive = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 7);
    return end;
  }, [weekStart]);

  const runsInWeek = useMemo(() => {
    return runs.filter((r) => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d >= weekStart && d < weekEndExclusive;
    });
  }, [runs, weekStart, weekEndExclusive]);

  const runsByDayInWeek = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of runsInWeek) {
      const key = dateKeyFromRun(r);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [runsInWeek]);

  const bucketStats = useMemo(() => {
    const stats: Record<
      CockpitBucket,
      { count: number; next: Run | null }
    > = {
      club: { count: 0, next: null },
      individual: { count: 0, next: null },
      shakeout: { count: 0, next: null },
      special: { count: 0, next: null },
      run_store: { count: 0, next: null },
    };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const r of runs) {
      const bucket = cockpitBucketForRun(r);
      if (!bucket) continue;
      stats[bucket].count++;
    }

    for (const bucket of COCKPIT_BUCKET_ORDER) {
      const inBucket = runs
        .filter((r) => cockpitBucketForRun(r) === bucket && r.date)
        .filter((r) => new Date(r.date) >= startOfToday)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      stats[bucket].next = inBucket[0] ?? null;
    }

    return stats;
  }, [runs]);

  const cockpitGridRuns = useMemo(() => {
    let list = runs;
    if (selectedBucket) {
      list = list.filter((r) => cockpitBucketForRun(r) === selectedBucket);
    }
    if (selectedDayYmd) {
      list = list.filter((r) => dateKeyFromRun(r) === selectedDayYmd);
    } else {
      list = list.filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        return d >= weekStart && d < weekEndExclusive;
      });
    }
    return [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [runs, selectedBucket, selectedDayYmd, weekStart, weekEndExclusive]);

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
        await loadRuns();
      }
    } catch {
      alert("Failed to approve run. Please try again.");
    }
  };

  const toggleBucket = (bucket: CockpitBucket) => {
    setSelectedBucket((prev) => (prev === bucket ? null : bucket));
  };

  const gridTitle = selectedDayYmd
    ? `Runs on ${formatRunDate(selectedDayYmd + "T12:00:00")}`
    : selectedBucket
      ? COCKPIT_BUCKET_META[selectedBucket].label
      : "This week on the calendar";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Run Manage</h1>
          <p className="mt-1 text-gray-600">
            Cockpit by run type — pick a lane, scan the week, drill in when you need the full list.
          </p>
        </div>
        <Link
          href={runManageCreatePath()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" />
          Create run
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {COCKPIT_BUCKET_ORDER.map((bucket) => {
          const meta = COCKPIT_BUCKET_META[bucket];
          const Icon = BUCKET_ICONS[bucket];
          const { count, next } = bucketStats[bucket];
          const active = selectedBucket === bucket;
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => toggleBucket(bucket)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${meta.border} ${meta.bg} ${
                active ? "ring-2 ring-sky-500 ring-offset-1" : "hover:brightness-[0.98]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 text-gray-700" />
                <span className="text-2xl font-bold text-gray-900">{loading ? "…" : count}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-900">{meta.label}</p>
              <p className="text-xs text-gray-600">{meta.description}</p>
              {next ? (
                <p className="mt-2 truncate text-xs font-medium text-gray-800">
                  Next: {next.title} · {formatRunDate(next.date)}
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No upcoming in this lane</p>
              )}
            </button>
          );
        })}
      </div>

      <RunManageWeekStrip
        weekStart={weekStart}
        runsByDay={runsByDayInWeek}
        selectedDayYmd={selectedDayYmd}
        onSelectDay={setSelectedDayYmd}
        onPrevWeek={() => {
          setWeekOffset((w) => w - 1);
          setSelectedDayYmd(null);
        }}
        onNextWeek={() => {
          setWeekOffset((w) => w + 1);
          setSelectedDayYmd(null);
        }}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{gridTitle}</h2>
        {loading ? (
          <p className="text-gray-500">Loading runs…</p>
        ) : cockpitGridRuns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            Nothing in this view.{" "}
            <Link href={runManageCreatePath()} className="font-medium text-sky-700 hover:underline">
              Create a run
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cockpitGridRuns.map((run) => {
              const status = (run.workflowStatus || "DEVELOP").toUpperCase();
              const bucket = cockpitBucketForRun(run);
              const bucketLabel = bucket ? COCKPIT_BUCKET_META[bucket].label : "Other";
              return (
                <article
                  key={run.id}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">{bucketLabel}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${workflowBadgeClass(status)}`}
                    >
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{run.title}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {formatRunDate(run.date)} ·{" "}
                      {formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod)}
                    </p>
                    <p className="inline-flex items-start gap-1">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-2">
                        {run.meetUpPoint}
                        {run.meetUpCity ? `, ${run.meetUpCity}` : ""}
                      </span>
                    </p>
                    {run.runClub?.name ? <p>{run.runClub.name}</p> : null}
                    {run.runBrand?.name ? (
                      <p className="text-emerald-800">Brand: {run.runBrand.name}</p>
                    ) : null}
                    <p className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      {run.rsvpCount ?? 0} RSVPs
                    </p>
                  </div>
                  <div className="mt-auto flex gap-2 pt-4">
                    <Link
                      href={`/runmanage/runs/${run.id}?mode=edit`}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
                    >
                      <Edit className="h-4 w-4" /> Edit
                    </Link>
                    <Link
                      href={`/runmanage/runs/${run.id}?mode=view`}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50/80">
        <button
          type="button"
          onClick={() => setFullListOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">All instances</h2>
            <p className="text-sm text-gray-600">
              Full workflow list with View, Edit, and Approve ({runs.length} total)
            </p>
          </div>
          {fullListOpen ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />
          )}
        </button>

        {fullListOpen ? (
          <div className="border-t border-gray-200 px-5 pb-5 pt-4">
            <div className="mb-4 flex flex-wrap gap-2">
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

            {loading ? (
              <p className="text-gray-500">Loading…</p>
            ) : filteredRuns.length === 0 ? (
              <p className="text-center text-gray-500">No runs match this filter.</p>
            ) : (
              <div className="space-y-3">
                {filteredRuns.map((run) => {
                  const completion = getRunCompletion(run);
                  const status = (run.workflowStatus || "DEVELOP").toUpperCase();
                  return (
                    <div
                      key={run.id}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">{run.title}</h3>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs ${workflowBadgeClass(status)}`}
                            >
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
                              {formatTime(
                                run.startTimeHour,
                                run.startTimeMinute,
                                run.startTimePeriod
                              )}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {run.meetUpPoint}
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
        ) : null}
      </section>
    </div>
  );
}
