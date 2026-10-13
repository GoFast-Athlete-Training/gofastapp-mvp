"use client";

import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";
import { useCallback, useEffect, useState } from "react";

export type BlueprintReadinessPayload = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  presetId: string | null;
  presetTitle: string | null;
  presetSlug: string | null;
  totalWeeks: number;
  weeksToGoal: number;
  buildWeekCount: number;
  taperWeekCount: number;
  hasBuild: boolean;
  hasTaper: boolean;
  hasRaceWeek: boolean;
  hasEasyRotation: boolean;
  taperUsesPresetCaps: boolean;
  shortPlanWarning: string | null;
};

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={ok ? "text-emerald-700" : "text-amber-700"} aria-hidden>
        {ok ? "✓" : "○"}
      </span>
      <span className={ok ? "text-gray-800" : "text-gray-600"}>{label}</span>
    </li>
  );
}

export function PlanBlueprintReadinessPanel({
  planId,
  startDateYmd,
  raceDateYmd,
  onStartDateSaved,
  getToken,
}: {
  planId: string;
  startDateYmd: string;
  raceDateYmd: string | null;
  onStartDateSaved: () => void;
  getToken: () => Promise<string | null>;
}) {
  const [readiness, setReadiness] = useState<BlueprintReadinessPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startDateLocal, setStartDateLocal] = useState(startDateYmd.slice(0, 10));
  const [savingStart, setSavingStart] = useState(false);
  const [startSaveError, setStartSaveError] = useState<string | null>(null);

  useEffect(() => {
    setStartDateLocal(startDateYmd.slice(0, 10));
  }, [startDateYmd]);

  const loadReadiness = useCallback(async () => {
    setLoadError(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `/api/training/plan/blueprint-readiness?planId=${encodeURIComponent(planId)}`,
        { headers: athleteBearerFetchHeaders(token) },
      );
      const data = (await res.json()) as BlueprintReadinessPayload & { error?: string };
      if (!res.ok) {
        setLoadError(data.error ?? "Could not load blueprint readiness");
        setReadiness(null);
        return;
      }
      setReadiness(data);
    } catch {
      setLoadError("Could not load blueprint readiness");
      setReadiness(null);
    }
  }, [getToken, planId]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  async function saveStartDate() {
    if (!startDateLocal) return;
    setSavingStart(true);
    setStartSaveError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/training-plan/${planId}`, {
        method: "PATCH",
        headers: {
          ...athleteBearerFetchHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ startDate: new Date(startDateLocal).toISOString() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStartSaveError(data.error ?? "Could not update start date");
        return;
      }
      onStartDateSaved();
      await loadReadiness();
    } catch {
      setStartSaveError("Could not update start date");
    } finally {
      setSavingStart(false);
    }
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-sm text-gray-800">
      <p className="font-semibold text-gray-900">Training blueprint</p>
      {loadError ? (
        <p className="mt-2 text-amber-900">{loadError}</p>
      ) : readiness ? (
        <>
          <p className="mt-2 text-gray-700">
            {readiness.presetTitle ? (
              <>
                <span className="font-medium text-gray-900">{readiness.presetTitle}</span>
                {readiness.presetSlug ? (
                  <span className="text-gray-500"> · {readiness.presetSlug}</span>
                ) : null}
                {readiness.presetId ? (
                  <span className="block text-xs text-gray-500 mt-0.5 font-mono">
                    {readiness.presetId}
                  </span>
                ) : null}
              </>
            ) : (
              "No preset title loaded yet."
            )}
          </p>
          <ul className="mt-3 space-y-1">
            <CheckRow ok={readiness.hasBuild} label="Build phase (rotations)" />
            <CheckRow ok={readiness.hasTaper} label="Taper phase (volume caps)" />
            <CheckRow ok={readiness.hasRaceWeek} label="Race week slots" />
            <CheckRow ok={readiness.hasEasyRotation} label="Easy run rotation" />
          </ul>
          <p className="mt-3 tabular-nums text-gray-800">
            <span className="font-medium">{readiness.weeksToGoal} weeks</span> to goal
            {readiness.buildWeekCount > 0 ? (
              <>
                {" "}
                · {readiness.buildWeekCount} build · {readiness.taperWeekCount} taper
              </>
            ) : (
              <> · mostly taper/race weeks</>
            )}
          </p>
          {readiness.taperUsesPresetCaps ? (
            <p className="mt-1 text-xs text-sky-900/90">
              Taper uses your coach&apos;s week caps (same weekly rotation as build, lower miles).
            </p>
          ) : null}
          {readiness.errors.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-950">
              {readiness.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}
          {readiness.warnings.map((w, i) => (
            <p key={i} className="mt-2 text-xs text-amber-900/95">
              {w}
            </p>
          ))}
        </>
      ) : (
        <p className="mt-2 text-gray-600">Loading blueprint…</p>
      )}

      <div className="mt-4 border-t border-sky-200/80 pt-4">
        <label className="block text-sm font-medium text-gray-900">
          When do you want to start training?
        </label>
        <p className="mt-1 text-xs text-gray-600">
          Goal race{" "}
          {raceDateYmd ? formatPlanDateDisplay(raceDateYmd) : "date not set"} — moving start
          changes how many build vs taper weeks you get.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input
            type="date"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={startDateLocal}
            onChange={(e) => setStartDateLocal(e.target.value)}
          />
          <button
            type="button"
            disabled={savingStart || startDateLocal === startDateYmd.slice(0, 10)}
            onClick={() => void saveStartDate()}
            className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
          >
            {savingStart ? "Saving…" : "Update start date"}
          </button>
        </div>
        {startSaveError ? (
          <p className="mt-2 text-xs text-red-700">{startSaveError}</p>
        ) : null}
      </div>
    </div>
  );
}
