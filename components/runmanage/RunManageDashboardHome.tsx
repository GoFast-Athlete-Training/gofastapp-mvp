"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Flag,
  Plus,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import {
  RUN_MANAGE_SERIES_PATH,
  runManageCreatePath,
  runManageTypePath,
} from "@/lib/runmanage/paths";
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
  name: string;
}

interface Run {
  id: string;
  title: string;
  date: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  runClub: RunClub | null;
  cityRunType?: string | null;
  runBrandId?: string | null;
  runClubId?: string | null;
  runStoreId?: string | null;
  athleteGeneratedId?: string | null;
}

const BUCKET_ICONS: Record<CockpitBucket, typeof Building2> = {
  club: Building2,
  individual: User,
  shakeout: Flag,
  special: Sparkles,
  run_store: Store,
};

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
  return ymdLocal(new Date(run.date));
}

function ownerForRun(run: Run): string {
  if (run.runClub?.name) return run.runClub.name;
  const bucket = cockpitBucketForRun(run);
  if (bucket === "individual") return "Athlete";
  if (bucket === "run_store") return "Store";
  return "—";
}

export function RunManageDashboardHome() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayYmd, setSelectedDayYmd] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ upcomingOnly: "false" });
        const response = await runmanageApi.get(`/api/runs/manage?${params.toString()}`);
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

  const bucketCounts = useMemo(() => {
    const counts: Record<CockpitBucket, number> = {
      club: 0,
      individual: 0,
      shakeout: 0,
      special: 0,
      run_store: 0,
    };
    for (const r of runs) {
      const b = cockpitBucketForRun(r);
      if (b) counts[b]++;
    }
    return counts;
  }, [runs]);

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

  const weekListRuns = useMemo(() => {
    let list = runsInWeek;
    if (selectedDayYmd) {
      list = list.filter((r) => dateKeyFromRun(r) === selectedDayYmd);
    }
    return [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [runsInWeek, selectedDayYmd]);

  const listTitle = selectedDayYmd
    ? `Runs on ${formatRunDate(selectedDayYmd + "T12:00:00")}`
    : "This week";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Run Manage</h1>
          <p className="mt-1 text-gray-600">What&apos;s happening this week.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={RUN_MANAGE_SERIES_PATH}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Manage recurring runs
          </Link>
          <Link
            href={runManageCreatePath()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Create run
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {COCKPIT_BUCKET_ORDER.map((bucket) => {
          const meta = COCKPIT_BUCKET_META[bucket];
          const Icon = BUCKET_ICONS[bucket];
          const count = bucketCounts[bucket];
          return (
            <Link
              key={bucket}
              href={runManageTypePath(bucket)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${meta.border} ${meta.bg} hover:brightness-[0.98]`}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 text-gray-700" />
                <span className="text-2xl font-bold text-gray-900">{loading ? "…" : count}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-900">{meta.label}</p>
              <p className="text-xs text-gray-600">{meta.description}</p>
              <p className="mt-2 text-xs font-medium text-sky-800">Open list →</p>
            </Link>
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
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{listTitle}</h2>
        {loading ? (
          <p className="text-gray-500">Loading runs…</p>
        ) : weekListRuns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            Nothing this week.{" "}
            <Link href={RUN_MANAGE_SERIES_PATH} className="font-medium text-sky-700 hover:underline">
              Manage recurring runs
            </Link>
            {" or "}
            <Link href={runManageCreatePath()} className="font-medium text-sky-700 hover:underline">
              create a one-off run
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3">Day & time</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {weekListRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                      {formatRunDate(run.date)}
                      <div className="text-xs text-gray-500">
                        {formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{run.title}</td>
                    <td className="px-4 py-3 text-gray-700">{ownerForRun(run)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/runmanage/runs/${run.id}?mode=edit`}
                        className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                      >
                        Edit
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
