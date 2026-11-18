"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ClipboardCopy, Loader2, Search, Upload } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import type { OperationalSeriesRow } from "@/lib/runmanage/series-operational-list";
import type { WeekWindow } from "@/lib/runmanage/calendar-week";
import type { RegionCityOption } from "@/lib/runmanage/week-board-filters";
import {
  RunManageWeekStrip,
  startOfWeekMonday,
  ymdLocal,
} from "@/components/runmanage/RunManageWeekStrip";
import { checkSeriesDateStamp, seriesDateStampLabel } from "@/lib/runmanage/series-date-stamp-check";
import {
  runInstanceEditPath,
  runManageCreateFromSeriesPath,
  RUN_MANAGE_THIS_WEEK_PATH,
} from "@/lib/runmanage/paths";
import { RunManageDayCorrectionsDialog } from "@/components/runmanage/RunManageDayCorrectionsDialog";
import { dayRunRowFromManageRun } from "@/lib/runmanage/day-validate-llm-packet";

type DayRun = {
  id: string;
  title: string;
  date?: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string;
  stravaEventUrl?: string | null;
  webUrl?: string | null;
  runClub: { id: string; name: string; websiteUrl?: string | null; stravaUrl?: string | null } | null;
};

function formatTime(hour: number | null, minute: number | null, period: string | null) {
  if (hour === null || minute === null) return "—";
  return `${hour}:${String(minute).padStart(2, "0")} ${period || "AM"}`;
}

export function RunManageThisWeekHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const region = searchParams.get("region")?.trim() ?? "";
  const city = searchParams.get("city")?.trim() ?? "";
  const clubId = searchParams.get("clubId")?.trim() ?? "";
  const selectedDayYmd = searchParams.get("dayYmd")?.trim() ?? "";
  const weekOffset = parseInt(searchParams.get("weekOffset") ?? "0", 10) || 0;

  const [filterOptions, setFilterOptions] = useState<RegionCityOption[]>([]);
  const [seriesRows, setSeriesRows] = useState<OperationalSeriesRow[]>([]);
  const [weekWindow, setWeekWindow] = useState<WeekWindow | null>(null);
  const [dayRuns, setDayRuns] = useState<DayRun[]>([]);
  const [llmPacket, setLlmPacket] = useState("");
  const [loading, setLoading] = useState(false);
  const [actingSeriesId, setActingSeriesId] = useState<string | null>(null);
  const [clubQuery, setClubQuery] = useState("");
  const [clubHits, setClubHits] = useState<Array<{ id: string; name: string }>>([]);
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  const [llmOpen, setLlmOpen] = useState(false);
  const [copiedPacket, setCopiedPacket] = useState(false);
  const [dayQuery, setDayQuery] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState<string | null>(null);

  const setParams = useCallback(
    (next: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(next)) {
        if (val === undefined || val === "") params.delete(key);
        else params.set(key, val);
      }
      const q = params.toString();
      router.replace(q ? `${RUN_MANAGE_THIS_WEEK_PATH}?${q}` : RUN_MANAGE_THIS_WEEK_PATH, {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await runmanageApi.get("/api/runmanage/run-series");
        if (res.data?.success) {
          setFilterOptions((res.data.filterOptions ?? []) as RegionCityOption[]);
        }
      } catch {
        setFilterOptions([]);
      }
    })();
  }, []);

  const regionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of filterOptions) map.set(o.regionSlug, o.regionName);
    return [...map.entries()].map(([slug, name]) => ({ slug, name }));
  }, [filterOptions]);

  const cityOptions = useMemo(() => {
    return filterOptions
      .filter((o) => !region || o.regionSlug === region)
      .map((o) => ({ slug: o.citySlug, name: o.cityName }));
  }, [filterOptions, region]);

  const loadWeek = useCallback(async () => {
    if (!region && !clubId) {
      setSeriesRows([]);
      setWeekWindow(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: "week" });
      if (region) params.set("region", region);
      if (city) params.set("city", city);
      if (clubId) params.set("clubId", clubId);
      if (weekOffset) params.set("weekOffset", String(weekOffset));
      const res = await runmanageApi.get(`/api/runmanage/run-series?${params.toString()}`);
      if (res.data?.success) {
        setWeekWindow(res.data.window ?? null);
        let rows = (res.data.series ?? []) as OperationalSeriesRow[];
        if (clubId) rows = rows.filter((r) => r.runClubId === clubId);
        setSeriesRows(rows);
      }
    } finally {
      setLoading(false);
    }
  }, [region, city, clubId, weekOffset]);

  const loadDay = useCallback(async () => {
    if (!region || !selectedDayYmd) {
      setDayRuns([]);
      setLlmPacket("");
      return;
    }
    try {
      const params = new URLSearchParams({ region, dayYmd: selectedDayYmd });
      if (city) params.set("city", city);
      const res = await runmanageApi.get(`/api/runmanage/this-week/day-runs?${params.toString()}`);
      if (res.data?.success) {
        setDayRuns((res.data.runs ?? []) as DayRun[]);
        setLlmPacket(String(res.data.packet ?? ""));
      }
    } catch {
      setDayRuns([]);
      setLlmPacket("");
    }
  }, [region, city, selectedDayYmd]);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    const q = clubQuery.trim();
    if (q.length < 2) {
      setClubHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await runmanageApi.get(
            `/api/runmanage/run-clubs/search?${new URLSearchParams({ q }).toString()}`
          );
          const clubs = (res.data?.clubs ?? []) as Array<{ id: string; name: string }>;
          setClubHits(Array.isArray(clubs) ? clubs : []);
        } catch {
          setClubHits([]);
        }
      })();
    }, 250);
    return () => window.clearTimeout(t);
  }, [clubQuery]);

  const weekStart = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const runsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of seriesRows) {
      const ymd = row.weekSlotYmd?.trim();
      if (!ymd) continue;
      map.set(ymd, (map.get(ymd) ?? 0) + 1);
    }
    return map;
  }, [seriesRows]);

  const dayChunkRows = useMemo(() => {
    if (!selectedDayYmd) return [];
    return seriesRows.filter((r) => r.weekSlotYmd === selectedDayYmd);
  }, [seriesRows, selectedDayYmd]);

  const cityNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of filterOptions) {
      if (!map.has(option.citySlug)) map.set(option.citySlug, option.cityName);
    }
    return map;
  }, [filterOptions]);

  const cityLabelFor = useCallback(
    (row: OperationalSeriesRow) => {
      const slug = row.citySlug?.trim();
      if (slug && cityNameBySlug.has(slug)) return cityNameBySlug.get(slug) ?? slug;
      return row.clubCity?.trim() || slug || "Unknown city";
    },
    [cityNameBySlug]
  );

  const visibleDayRows = useMemo(() => {
    const term = dayQuery.trim().toLowerCase();
    if (!term) return dayChunkRows;
    return dayChunkRows.filter((row) => {
      const hay = [row.clubName, row.meetUpPoint, row.name, cityLabelFor(row), row.citySlug]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [dayChunkRows, dayQuery, cityLabelFor]);

  const dayCityGroups = useMemo(() => {
    const map = new Map<string, OperationalSeriesRow[]>();
    for (const row of visibleDayRows) {
      const key = cityLabelFor(row);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleDayRows, cityLabelFor]);

  const multiCityDay = !city && dayCityGroups.length > 1;

  const publishableRunIds = useMemo(
    () =>
      dayRuns
        .filter((run) => !clubId || run.runClub?.id === clubId)
        .map((run) => run.id),
    [dayRuns, clubId]
  );

  const backToDayHref = useMemo(() => {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (city) params.set("city", city);
    if (clubId) params.set("clubId", clubId);
    if (selectedDayYmd) params.set("dayYmd", selectedDayYmd);
    if (weekOffset) params.set("weekOffset", String(weekOffset));
    const q = params.toString();
    return q ? `${RUN_MANAGE_THIS_WEEK_PATH}?${q}` : RUN_MANAGE_THIS_WEEK_PATH;
  }, [region, city, clubId, selectedDayYmd, weekOffset]);

  const allowedRunIds = useMemo(() => dayRuns.map((r) => r.id), [dayRuns]);

  const runsForParse = useMemo(
    () =>
      dayRuns.map((r) =>
        dayRunRowFromManageRun({
          id: r.id,
          title: r.title,
          date: r.date ?? selectedDayYmd,
          startTimeHour: r.startTimeHour,
          startTimeMinute: r.startTimeMinute,
          startTimePeriod: r.startTimePeriod,
          meetUpPoint: r.meetUpPoint,
          stravaEventUrl: r.stravaEventUrl,
          webUrl: r.webUrl,
          runClub: r.runClub,
        })
      ),
    [dayRuns, selectedDayYmd]
  );

  const handleReuseLastRun = async (row: OperationalSeriesRow) => {
    if (!row.weekSlotYmd) return;
    setActingSeriesId(row.seriesId);
    try {
      const res = await runmanageApi.post(
        `/api/runmanage/run-series/${encodeURIComponent(row.seriesId)}/advance-slot`,
        { targetDateYmd: row.weekSlotYmd }
      );
      if (res.data?.success && res.data.runId) {
        const editParams = new URLSearchParams();
        editParams.set("mode", "edit");
        editParams.set("returnTo", backToDayHref);
        router.push(`/runmanage/runs/${res.data.runId}?${editParams.toString()}`);
        return;
      }
      await loadWeek();
      await loadDay();
    } finally {
      setActingSeriesId(null);
    }
  };

  const handlePublishAll = async () => {
    if (publishableRunIds.length === 0) return;
    setPublishing(true);
    setPublishNote(null);
    try {
      const res = await runmanageApi.post("/api/runs/manage/bulk-publish", {
        runIds: publishableRunIds,
      });
      if (!res.data?.success) {
        setPublishNote(res.data?.error || "Could not publish these runs");
        return;
      }
      setPublishNote(
        typeof res.data.message === "string"
          ? res.data.message
          : `Published ${res.data.published ?? publishableRunIds.length} runs`
      );
      await loadWeek();
      await loadDay();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setPublishNote(err.response?.data?.error || err.message || "Could not publish these runs");
    } finally {
      setPublishing(false);
    }
  };

  const editRunHref = (runId: string) => {
    const base = runInstanceEditPath(runId);
    return `${base}&returnTo=${encodeURIComponent(backToDayHref)}`;
  };

  const renderDaySlot = (row: OperationalSeriesRow, showCity: boolean) => {
    const check = checkSeriesDateStamp({
      series: row,
      weekRunId: row.weekRun?.id ?? null,
      latestPriorRunId: row.latestPriorRun?.id ?? null,
    });
    const run = row.weekRun;
    return (
      <li
        key={row.seriesId}
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white bg-white px-4 py-3 shadow-sm"
      >
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{row.clubName ?? "Club"}</p>
          <p className="text-xs text-gray-600">
            {formatTime(row.startTimeHour, row.startTimeMinute, row.startTimePeriod)} · {row.meetUpPoint}
          </p>
          {showCity ? (
            <p className="mt-0.5 text-xs text-gray-500">{cityLabelFor(row)}</p>
          ) : null}
          {run ? (
            <span
              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                run.published ? "bg-emerald-100 text-emerald-900" : "bg-gray-100 text-gray-800"
              }`}
            >
              {run.published ? "Live" : "Not live"}
            </span>
          ) : (
            <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800">
              {seriesDateStampLabel(check.kind)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {run ? (
            <Link
              href={editRunHref(run.id)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Edit
            </Link>
          ) : check.kind === "reuse_last_run" ? (
            <button
              type="button"
              disabled={actingSeriesId === row.seriesId}
              onClick={() => void handleReuseLastRun(row)}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Reuse last run
            </button>
          ) : (
            <Link
              href={runManageCreateFromSeriesPath(row.seriesId, { dateYmd: row.weekSlotYmd })}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              Build
            </Link>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage this week&apos;s runs</h1>
        <p className="mt-1 text-gray-600">Pick a region, then a day. A city narrows the list.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-900">1. Pick a region</p>
        <div className="flex flex-wrap gap-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Region</span>
            <select
              value={region}
              onChange={(e) =>
                setParams({ region: e.target.value, city: undefined, dayYmd: undefined, clubId: undefined })
              }
              className="mt-1 block min-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select region…</option>
              {regionOptions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">City</span>
            <select
              value={city}
              disabled={!region}
              onChange={(e) => setParams({ city: e.target.value, dayYmd: undefined })}
              className="mt-1 block min-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-50"
            >
              <option value="">All cities in region</option>
              {cityOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <h2 className="text-sm font-semibold text-gray-900">Or pick a club + day</h2>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={clubQuery}
            onChange={(e) => setClubQuery(e.target.value)}
            placeholder="Search club name…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
          {clubHits.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              {clubHits.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setParams({ clubId: c.id, city: undefined, region: undefined, dayYmd: undefined });
                      setClubQuery(c.name);
                      setClubHits([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-sky-50"
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {clubId ? (
          <button
            type="button"
            onClick={() => setParams({ clubId: undefined })}
            className="text-sm font-medium text-sky-800 hover:underline"
          >
            Clear club filter
          </button>
        ) : null}
      </div>

      {region || clubId ? (
        <>
          <p className="text-sm text-gray-600">2. Pick a day this week</p>
          <RunManageWeekStrip
            weekStart={weekStart}
            runsByDay={runsByDay}
            selectedDayYmd={selectedDayYmd || null}
            onSelectDay={(ymd) => {
              setDayQuery("");
              setPublishNote(null);
              setParams({ dayYmd: ymd ?? undefined });
            }}
            onPrevWeek={() => {
              setDayQuery("");
              setPublishNote(null);
              setParams({
                weekOffset: weekOffset - 1 === 0 ? undefined : String(weekOffset - 1),
                dayYmd: undefined,
              });
            }}
            onNextWeek={() => {
              setDayQuery("");
              setPublishNote(null);
              setParams({ weekOffset: String(weekOffset + 1), dayYmd: undefined });
            }}
          />
        </>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : null}

      {selectedDayYmd && (region || clubId) ? (
        <section className="space-y-4 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedDayYmd}</h2>
              <p className="text-sm text-gray-600">
                {dayChunkRows.length} slots · {dayRuns.length} runs
                {city ? "" : " in this region"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={publishing || publishableRunIds.length === 0}
                onClick={() => void handlePublishAll()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Publish all
              </button>
              <button
                type="button"
                disabled={!region || dayRuns.length === 0}
                onClick={() => {
                  setCopiedPacket(false);
                  setLlmOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                <ClipboardCopy className="h-4 w-4" />
                Validate with LLM
              </button>
              <button
                type="button"
                disabled={allowedRunIds.length === 0}
                onClick={() => setCorrectionsOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Ingest updates
              </button>
            </div>
          </div>

          {publishNote ? <p className="text-sm text-gray-700">{publishNote}</p> : null}

          <label className="relative block max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={dayQuery}
              onChange={(e) => setDayQuery(e.target.value)}
              placeholder="Search club, meet-up, or city…"
              aria-label="Search this day's slots"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
            />
          </label>

          {visibleDayRows.length === 0 ? (
            <p className="text-sm text-gray-600">
              {dayChunkRows.length === 0
                ? "No slots on this day."
                : "No slots match that search."}
            </p>
          ) : multiCityDay ? (
            <div className="space-y-2">
              {dayCityGroups.map(([label, rows], index) => (
                <CollapsibleSection
                  key={`${selectedDayYmd}-${label}`}
                  title={label}
                  count={rows.length}
                  defaultOpen={index === 0}
                  forceOpen={Boolean(dayQuery.trim())}
                >
                  <ul className="space-y-2 px-2 pb-2">{rows.map((row) => renderDaySlot(row, false))}</ul>
                </CollapsibleSection>
              ))}
            </div>
          ) : (
            <ul className="space-y-2">{visibleDayRows.map((row) => renderDaySlot(row, !city))}</ul>
          )}
        </section>
      ) : null}

      {llmOpen ? (
        <LlmPacketDialog
          packet={llmPacket}
          copied={copiedPacket}
          onCopy={async () => {
            await navigator.clipboard.writeText(llmPacket);
            setCopiedPacket(true);
          }}
          onClose={() => setLlmOpen(false)}
        />
      ) : null}

      <RunManageDayCorrectionsDialog
        open={correctionsOpen}
        onClose={() => setCorrectionsOpen(false)}
        allowedRunIds={allowedRunIds}
        runsForParse={runsForParse}
        onApplied={() => {
          void loadWeek();
          void loadDay();
        }}
      />
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  defaultOpen,
  forceOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  forceOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const shown = forceOpen || open;
  return (
    <details
      open={shown}
      onToggle={(event) => {
        if (forceOpen) return;
        setOpen(event.currentTarget.open);
      }}
      className="overflow-hidden rounded-lg border border-white bg-white/70"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          <span className="ml-2 font-normal text-gray-500">{count}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${shown ? "rotate-180" : ""}`} />
      </summary>
      {children}
    </details>
  );
}

function LlmPacketDialog({
  packet,
  copied,
  onCopy,
  onClose,
}: {
  packet: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative z-[201] max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">LLM fact-check — this day</h2>
        </div>
        <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap p-5 font-mono text-xs">{packet}</pre>
        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" onClick={() => void onCopy()} className="rounded-lg border px-3 py-2 text-sm">
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-sky-600 px-3 py-2 text-sm text-white">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
