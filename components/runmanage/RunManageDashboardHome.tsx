"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Edit, Eye, MapPin, Plus, Users } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import {
  runManageCreatePath,
  runManageTypePath,
  RUN_MANAGE_CLUBS_PATH,
  RUN_MANAGE_SERIES_PATH,
} from "@/lib/runmanage/paths";
import {
  COCKPIT_BUCKET_META,
  COCKPIT_BUCKET_ORDER,
  cockpitBucketForRun,
} from "@/lib/runmanage/run-cockpit-buckets";
import {
  RunManageWeekStrip,
  startOfWeekMonday,
  ymdLocal,
} from "@/components/runmanage/RunManageWeekStrip";
import { DMV_REGION_SLUG, isDmvRegionSlug } from "@/lib/region-slug";

const REGION_CITY_FILTER_PREFIX = "region:";

interface RunClub {
  id: string;
  name: string;
}

interface Run {
  id: string;
  title: string;
  citySlug: string;
  regionSlug?: string | null;
  meetUpPoint: string;
  meetUpCity: string | null;
  date: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  workflowStatus?: string;
  runClub: RunClub | null;
  runClubId?: string | null;
  runBrandId?: string | null;
  cityRunType?: string | null;
  athleteGeneratedId?: string | null;
  runStoreId?: string | null;
  rsvpCount?: number;
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
  return ymdLocal(new Date(run.date));
}

function workflowBadgeClass(status: string) {
  if (status === "APPROVED") return "bg-green-100 text-green-700 border-green-200";
  if (status === "SUBMITTED") return "bg-blue-50 text-blue-800 border-blue-200";
  if (status === "PENDING") return "bg-yellow-50 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export function RunManageDashboardHome() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayYmd, setSelectedDayYmd] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedCityKey, setSelectedCityKey] = useState<string>("");
  const [selectedRunClubId, setSelectedRunClubId] = useState<string>("");

  const loadRuns = async (runClubId?: string) => {
    const params = new URLSearchParams({ upcomingOnly: "false" });
    if (runClubId?.trim()) params.set("runClubId", runClubId.trim());
    const response = await runmanageApi.get(`/api/runs/manage?${params.toString()}`);
    if (response.data.success) {
      setRuns(response.data.runs || []);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await loadRuns(selectedRunClubId || undefined);
      } catch (error) {
        console.error("Error fetching runs:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedRunClubId]);

  const cityOptions = useMemo(() => {
    const map = new Map<string, string>();
    let hasDmv = false;
    for (const r of runs) {
      if (isDmvRegionSlug(r.regionSlug)) {
        hasDmv = true;
        continue;
      }
      const key = (r.citySlug || r.meetUpCity || "").trim().toLowerCase();
      if (!key) continue;
      const label = r.meetUpCity?.trim() || r.citySlug?.trim() || key;
      map.set(key, label);
    }
    const options: Array<[string, string]> = [];
    if (hasDmv) {
      options.push([`${REGION_CITY_FILTER_PREFIX}${DMV_REGION_SLUG}`, "DMV"]);
    }
    options.push(...[...map.entries()].sort((a, b) => a[1].localeCompare(b[1])));
    return options;
  }, [runs]);

  const clubOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of runs) {
      const club = r.runClub;
      const id = r.runClubId || club?.id;
      if (!id || !club?.name) continue;
      map.set(id, club.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [runs]);

  const scopedRuns = useMemo(() => {
    let list = runs;
    if (selectedCityKey) {
      if (selectedCityKey.startsWith(REGION_CITY_FILTER_PREFIX)) {
        const region = selectedCityKey.slice(REGION_CITY_FILTER_PREFIX.length);
        list = list.filter((r) => (r.regionSlug || "").trim().toLowerCase() === region);
      } else {
        list = list.filter((r) => {
          const slug = (r.citySlug || "").trim().toLowerCase();
          const city = (r.meetUpCity || "").trim().toLowerCase();
          return slug === selectedCityKey || city === selectedCityKey;
        });
      }
    }
    return list;
  }, [runs, selectedCityKey]);

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
    return scopedRuns.filter((r) => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d >= weekStart && d < weekEndExclusive;
    });
  }, [scopedRuns, weekStart, weekEndExclusive]);

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

  const gridTitle = selectedDayYmd
    ? `Runs on ${formatRunDate(selectedDayYmd + "T12:00:00")}`
    : selectedCityKey || selectedRunClubId
      ? "This week (filtered)"
      : "This week";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Run Manage</h1>
          <p className="mt-1 text-gray-600">Week cockpit — scan dated runs, then drill into series or clubs.</p>
        </div>
        <Link
          href={runManageCreatePath()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" />
          Create run
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={RUN_MANAGE_SERIES_PATH}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-sky-800 hover:bg-sky-50"
        >
          All series
        </Link>
        <Link
          href={RUN_MANAGE_CLUBS_PATH}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-sky-800 hover:bg-sky-50"
        >
          Build by clubs
        </Link>
        {COCKPIT_BUCKET_ORDER.map((bucket) => (
          <Link
            key={bucket}
            href={runManageTypePath(bucket)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50"
          >
            {COCKPIT_BUCKET_META[bucket].label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <label className="block min-w-[10rem] flex-1 text-sm">
          <span className="mb-1 block font-medium text-gray-700">City</span>
          <select
            value={selectedCityKey}
            onChange={(e) => {
              setSelectedCityKey(e.target.value);
              setSelectedDayYmd(null);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All cities</option>
            {cityOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[12rem] flex-1 text-sm">
          <span className="mb-1 block font-medium text-gray-700">Run club</span>
          <select
            value={selectedRunClubId}
            onChange={(e) => {
              setSelectedRunClubId(e.target.value);
              setSelectedDayYmd(null);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All clubs</option>
            {clubOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {(selectedCityKey || selectedRunClubId) && (
          <button
            type="button"
            onClick={() => {
              setSelectedCityKey("");
              setSelectedRunClubId("");
              setSelectedDayYmd(null);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
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
        ) : weekListRuns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            Nothing this week.{" "}
            <Link href={runManageCreatePath()} className="font-medium text-sky-700 hover:underline">
              Create a run
            </Link>{" "}
            or build from{" "}
            <Link href={RUN_MANAGE_SERIES_PATH} className="font-medium text-sky-700 hover:underline">
              series
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weekListRuns.map((run) => {
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
    </div>
  );
}
