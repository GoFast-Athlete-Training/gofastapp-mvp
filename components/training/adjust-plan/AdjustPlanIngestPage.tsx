"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, FileUp, PenLine } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import IntakeModePicker, { type IntakeMode } from "@/components/runmanage/intake/IntakeModePicker";
import { PlanWeekPreviewList } from "@/components/training/adjust-plan/PlanWeekPreviewList";
import {
  PLAN_WEEK_CSV_DOWNLOAD_FILENAME,
  PLAN_WEEK_CSV_TEMPLATE,
} from "@/lib/training/plan-week-csv-template";
import { usePlanIngestPreviewCommit } from "@/lib/training/use-plan-ingest-preview-commit";
import { fetchTrainingPlanDetail } from "@/lib/training/fetch-plan-week-client";
import { weekBoundsFromPlan } from "@/lib/training/plan-schedule";
import { formatPlanDateDisplay, ymdFromDate } from "@/lib/training/plan-utils";

type AdjustLane = IntakeMode | "photo";

function downloadPlanWeekCsvTemplate(): void {
  const blob = new Blob([PLAN_WEEK_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = PLAN_WEEK_CSV_DOWNLOAD_FILENAME;
  anchor.click();
  URL.revokeObjectURL(url);
}

type Props = {
  planId: string;
  weekNumber: number | null;
};

export function AdjustPlanIngestPage({ planId, weekNumber }: Props) {
  const router = useRouter();
  const isWeekScope = weekNumber != null && weekNumber > 0;
  const scope = isWeekScope ? "week" : "plan";

  const [lane, setLane] = useState<AdjustLane | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [weekRangeLabel, setWeekRangeLabel] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const getToken = useCallback(async () => {
    const user = auth.currentUser;
    return user ? user.getIdToken() : null;
  }, []);

  const { preview, error, loading, committing, runPreview, runCommit, resetPreview } =
    usePlanIngestPreviewCommit({
      planId,
      scope,
      getToken,
      weekNumber: weekNumber ?? undefined,
    });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setAuthReady(true));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      const { plan } = await fetchTrainingPlanDetail(planId, token);
      if (!plan) return;
      setPlanLabel(plan.name);
      if (isWeekScope && weekNumber) {
        const raceDate = plan.race_registry?.raceDate
          ? new Date(plan.race_registry.raceDate)
          : null;
        const bounds = weekBoundsFromPlan(new Date(plan.startDate), weekNumber, {
          raceDate,
          totalWeeks: plan.totalWeeks,
        });
        const start = formatPlanDateDisplay(ymdFromDate(bounds.weekStart), {
          month: "short",
          day: "numeric",
        });
        const end = formatPlanDateDisplay(ymdFromDate(bounds.weekEnd), {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        setWeekRangeLabel(`Week ${weekNumber} · ${start} – ${end}`);
      }
    })();
  }, [authReady, getToken, isWeekScope, planId, weekNumber]);

  const intakeModes: IntakeMode[] = useMemo(
    () => (isWeekScope ? ["paste", "csv"] : ["paste"]),
    [isWeekScope]
  );

  const pickerMode: IntakeMode | null =
    lane === "paste" || lane === "csv" ? lane : lane === null ? null : "paste";

  const onCsvFile = useCallback(
    (file: File) => {
      resetPreview();
      void file.text().then((text) => {
        void runPreview(text);
      });
    },
    [resetPreview, runPreview]
  );

  const onConfirm = useCallback(async () => {
    const ok = await runCommit();
    if (ok) router.push("/training");
  }, [runCommit, router]);

  const title = isWeekScope ? "Adjust this week" : "Adjust plan";
  const pageTitle = planLabel ? `${title} · ${planLabel}` : title;

  return (
    <AthleteAppShell>
      <div className="mx-auto max-w-4xl px-4 py-6 pb-24">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/training"
            className="text-sm font-semibold text-sky-800 hover:underline"
          >
            ← Training
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
          {weekRangeLabel ? (
            <p className="mt-1 text-sm text-gray-600">{weekRangeLabel}</p>
          ) : null}
          <p className="mt-2 text-sm text-gray-700">
            {isWeekScope
              ? "Replace workouts in this calendar week. Do not include goal race day in CSV — protected days stay unchanged."
              : "Replace future weeks from your paste. Completed weeks stay as-is."}
          </p>
        </header>

        {lane === null ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setLane("paste")}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50/50"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <PenLine className="h-4 w-4 shrink-0 text-sky-600" />
                Paste
              </span>
              <p className="mt-2 text-sm text-slate-600">
                Freeform lines like Mon easy 5, Wed tempo 6 — preview each workout before saving.
              </p>
            </button>
            {isWeekScope ? (
              <button
                type="button"
                onClick={() => setLane("csv")}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50/50"
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileUp className="h-4 w-4 shrink-0 text-sky-600" />
                  CSV upload
                </span>
                <p className="mt-2 text-sm text-slate-600">
                  Download the template, fill training days only, upload — we map columns to a
                  workout table (no raw dump).
                </p>
              </button>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
                CSV is for single-week replace. Use paste for the full plan.
              </div>
            )}
            <div
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-70"
              aria-disabled
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                <Camera className="h-4 w-4 shrink-0" />
                Photo
              </span>
              <p className="mt-2 text-sm text-slate-500">
                Snap or upload a plan screenshot (coming soon).
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLane(null);
                  resetPreview();
                  setPasteText("");
                }}
                className="text-sm font-semibold text-sky-800 hover:underline"
              >
                ← Change method
              </button>
              {isWeekScope ? (
                <IntakeModePicker
                  mode={pickerMode}
                  onChange={(m) => {
                    setLane(m);
                    resetPreview();
                    setPasteText("");
                  }}
                  modes={intakeModes}
                  descriptions={{
                    paste: "Paste day lines for this week.",
                    csv: "Upload CSV — preview maps to workouts automatically.",
                  }}
                />
              ) : null}
            </div>

            {lane === "csv" && isWeekScope ? (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadPlanWeekCsvTemplate()}
                    className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-50"
                  >
                    Download CSV template
                  </button>
                  <label className="cursor-pointer rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-50">
                    {loading ? "Parsing…" : "Upload CSV"}
                    <input
                      type="file"
                      accept=".csv,.txt,text/csv,text/plain"
                      className="sr-only"
                      disabled={loading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onCsvFile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-600">
                  Types: Easy, Tempo, Intervals, LongRun only. Shakeout → Easy. Race day omitted.
                </p>
              </div>
            ) : null}

            {lane === "paste" ? (
              <div className="space-y-3">
                <textarea
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value);
                    resetPreview();
                  }}
                  rows={isWeekScope ? 8 : 12}
                  placeholder={
                    isWeekScope
                      ? "Mon easy 5\nWed tempo 6\nSat long 14"
                      : "Week 8\nMon easy 4\n...\nWeek 9\n..."
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  disabled={loading || !pasteText.trim()}
                  onClick={() => void runPreview(pasteText)}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {loading ? "Parsing…" : "Preview"}
                </button>
              </div>
            ) : null}

            {preview?.scope === "week" ? (
              preview.weekPreviewDays?.length ? (
                <PlanWeekPreviewList
                  days={preview.weekPreviewDays}
                  summary={preview.summary}
                  ingestRows={preview.weekIngestRows}
                />
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  No workouts to apply for this week — check dates in your paste or CSV.
                  {preview.summary ? ` ${preview.summary}` : ""}
                </p>
              )
            ) : null}

            {preview?.scope === "plan" ? (
              <p className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-sm text-gray-800">
                {preview.summary}
              </p>
            ) : null}

            {preview ? (
              <button
                type="button"
                disabled={committing}
                onClick={() => void onConfirm()}
                className="rounded-lg border border-sky-600 bg-white px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
              >
                {committing ? "Saving…" : "Confirm & apply"}
              </button>
            ) : null}

            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>
        )}
      </div>
    </AthleteAppShell>
  );
}
