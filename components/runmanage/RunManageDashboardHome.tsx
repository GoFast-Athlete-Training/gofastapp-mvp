"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardCopy, Upload } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { RUN_MANAGE_THIS_WEEK_PATH, runManageCreatePath } from "@/lib/runmanage/paths";
import { dayRunRowFromManageRun } from "@/lib/runmanage/day-validate-llm-packet";
import { RunManageDayCorrectionsDialog } from "@/components/runmanage/RunManageDayCorrectionsDialog";
import {
  RunManageWeekStrip,
  startOfWeekMonday,
  ymdLocal,
} from "@/components/runmanage/RunManageWeekStrip";

interface Run {
  id: string;
  date: string;
}

type DayRun = {
  id: string;
  title: string;
  date: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string | null;
  stravaEventUrl?: string | null;
  webUrl?: string | null;
  runClub: {
    name?: string | null;
    websiteUrl?: string | null;
    stravaUrl?: string | null;
  } | null;
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

function dateKeyFromRun(run: Run): string {
  if (!run.date) return "";
  return ymdLocal(new Date(run.date));
}

export function RunManageDashboardHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayYmd, setSelectedDayYmd] = useState<string | null>(null);
  const [dayRuns, setDayRuns] = useState<DayRun[]>([]);
  const [llmPacket, setLlmPacket] = useState("");
  const [dayLoading, setDayLoading] = useState(false);
  const [llmOpen, setLlmOpen] = useState(false);
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  const [copiedPacket, setCopiedPacket] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const weekOffset = parseInt(searchParams.get("weekOffset") ?? "0", 10) || 0;

  const setWeekOffset = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 0) params.delete("weekOffset");
    else params.set("weekOffset", String(next));
    const q = params.toString();
    router.replace(q ? `/runmanage/runs?${q}` : "/runmanage/runs", { scroll: false });
  };

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const { weekWindowContaining } = await import("@/lib/runmanage/calendar-week");
        const win = weekWindowContaining(new Date(), weekOffset);
        const params = new URLSearchParams({
          weekStart: win.startYmd,
          weekEndExclusive: win.endExclusiveYmd,
          upcomingOnly: "false",
        });
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
  }, [weekOffset, reloadKey]);

  useEffect(() => {
    if (!selectedDayYmd) {
      setDayRuns([]);
      setLlmPacket("");
      setDayLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setDayLoading(true);
      try {
        const params = new URLSearchParams({ dayYmd: selectedDayYmd });
        const res = await runmanageApi.get(`/api/runmanage/this-week/day-runs?${params.toString()}`);
        if (cancelled) return;
        if (res.data?.success) {
          setDayRuns((res.data.runs ?? []) as DayRun[]);
          setLlmPacket(String(res.data.packet ?? ""));
        } else {
          setDayRuns([]);
          setLlmPacket("");
        }
      } catch (error) {
        console.error("Error fetching day runs:", error);
        if (!cancelled) {
          setDayRuns([]);
          setLlmPacket("");
        }
      } finally {
        if (!cancelled) setDayLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDayYmd, reloadKey]);

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

  const runsByDayInWeek = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of runs) {
      if (!r.date) continue;
      const d = new Date(r.date);
      if (d < weekStart || d >= weekEndExclusive) continue;
      const key = dateKeyFromRun(r);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [runs, weekStart, weekEndExclusive]);

  const runsForParse = useMemo(
    () =>
      dayRuns.map((r) =>
        dayRunRowFromManageRun({
          id: r.id,
          title: r.title,
          date: r.date ?? selectedDayYmd ?? "",
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

  const allowedRunIds = useMemo(() => dayRuns.map((r) => r.id), [dayRuns]);
  const dayTitle = selectedDayYmd
    ? formatRunDate(`${selectedDayYmd}T12:00:00`)
    : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-600">All metros — select a day to check the runs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={RUN_MANAGE_THIS_WEEK_PATH}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Manage this week&apos;s runs
          </Link>
          <Link
            href={runManageCreatePath()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Create run
          </Link>
        </div>
      </div>

      <RunManageWeekStrip
        weekStart={weekStart}
        runsByDay={runsByDayInWeek}
        selectedDayYmd={selectedDayYmd}
        onSelectDay={setSelectedDayYmd}
        onPrevWeek={() => {
          setWeekOffset(weekOffset - 1);
          setSelectedDayYmd(null);
        }}
        onNextWeek={() => {
          setWeekOffset(weekOffset + 1);
          setSelectedDayYmd(null);
        }}
      />

      {loading && !selectedDayYmd ? (
        <p className="text-sm text-gray-500">Loading the week…</p>
      ) : null}

      {!selectedDayYmd ? (
        <p className="text-sm text-gray-600">Select a day.</p>
      ) : (
        <section className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{dayTitle}</h2>
              <p className="text-sm text-gray-600">
                {dayLoading
                  ? "Loading this day…"
                  : `${dayRuns.length} run${dayRuns.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={dayLoading}
                onClick={() => {
                  setCopiedPacket(false);
                  setLlmOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                <ClipboardCopy className="h-4 w-4" />
                Check this day
              </button>
              <button
                type="button"
                disabled={dayLoading || allowedRunIds.length === 0}
                onClick={() => setCorrectionsOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Ingest updates
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            One packet covers this day. Copy it, then paste corrections back here.
          </p>
        </section>
      )}

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
        onApplied={() => setReloadKey((n) => n + 1)}
      />
    </div>
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
