"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MIN_WEEKLY_MI = 40;

type PlanListItem = {
  id: string;
  name: string;
  lifecycleStatus?: string;
};

type PresetCheckResponse = {
  planId: string;
  planName: string;
  storedPresetId: string | null;
  resolvedPresetId: string;
  presetSlug: string;
  presetTitle: string;
  cycleLen: number | null;
  minWeeklyMiles: number | null;
  maxWeeklyMiles: number | null;
  baseMiles: number | null;
  peakMiles: number | null;
  taperMiles: number | null;
  tempoIdealDow: number | null;
  intervalIdealDow: number | null;
  longRunDefaultDow: number | null;
  positions: {
    longRun: {
      cyclePosition: number;
      distributionWeight: number;
      catalogueId: string | null;
      catalogueName: string | null;
      catalogueSlug: string | null;
    }[];
    intervals: {
      cyclePosition: number;
      distributionWeight: number;
      catalogueId: string | null;
      catalogueName: string | null;
      catalogueSlug: string | null;
    }[];
    tempo: {
      cyclePosition: number;
      distributionWeight: number;
      catalogueId: string | null;
      catalogueName: string | null;
      catalogueSlug: string | null;
    }[];
  };
};

function dowLabel(n: number | null | undefined): string {
  if (n == null || n < 1 || n > 7) return "—";
  return DOW[n];
}

function PositionBlock({
  label,
  rows,
}: {
  label: string;
  rows: PresetCheckResponse["positions"]["longRun"];
}) {
  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">
        {label} ({rows.length} slots)
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-amber-700">No position rows in DB.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm text-gray-800">
          {rows.map((r) => (
            <li key={r.cyclePosition} className="flex flex-wrap gap-x-2 border-b border-gray-50 pb-1.5 last:border-0">
              <span className="font-mono text-xs text-gray-500">slot {r.cyclePosition}</span>
              <span className="tabular-nums">weight {r.distributionWeight}</span>
              {r.catalogueId ? (
                <>
                  {r.catalogueName ? (
                    <span>
                      {r.catalogueName}
                      {r.catalogueSlug ? (
                        <span className="text-gray-500"> ({r.catalogueSlug})</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="font-medium text-red-600">
                      ID {r.catalogueId.slice(0, 8)}… (no catalogue row)
                    </span>
                  )}
                </>
              ) : (
                <span className="font-medium text-red-600">no catalogue linked</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TrainingGenerateTestPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [planId, setPlanId] = useState("");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [testing, setTesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PresetCheckResponse | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthReady(false);
        router.replace("/welcome");
        return;
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [router]);

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch("/api/training-plan", {
        headers: athleteBearerFetchHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not list plans");
        setPlans([]);
        return;
      }
      const list = (data.plans ?? []) as PlanListItem[];
      setPlans(list);
      if (list.length > 0 && !planId) {
        setPlanId(list[0]!.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingPlans(false);
    }
  }, [planId]);

  useEffect(() => {
    if (!authReady) return;
    void loadPlans();
  }, [authReady, loadPlans]);

  async function runPresetCheck() {
    if (!planId.trim()) {
      setError("Select a plan");
      return;
    }
    setTesting(true);
    setError(null);
    setResult(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Sign in required");
      const token = await u.getIdToken();
      const res = await fetch(
        `/api/training/plan/preset-check?planId=${encodeURIComponent(planId)}`,
        { headers: athleteBearerFetchHeaders(token) }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "preset-check failed");
        return;
      }
      setResult(data as PresetCheckResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setTesting(false);
    }
  }

  async function runGenerate() {
    if (!planId.trim()) {
      setError("Select a plan");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Sign in required");
      const token = await u.getIdToken();
      const detailRes = await fetch(`/api/training-plan/${planId}`, {
        headers: athleteBearerFetchHeaders(token),
      });
      const detailData = await detailRes.json();
      let targetMiles = 50;
      if (detailRes.ok && detailData.plan) {
        const t = (detailData.plan as { weeklyMileageTarget?: number | null })
          .weeklyMileageTarget;
        if (t != null && Number.isFinite(Number(t))) {
          targetMiles = Math.round(Number(t));
        }
      }
      targetMiles = Math.max(MIN_WEEKLY_MI, Math.min(100, targetMiles));

      const genRes = await fetch("/api/training/plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          trainingPlanId: planId,
          weeklyMileageTarget: targetMiles,
          minWeeklyMiles: MIN_WEEKLY_MI,
        }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setError(genData.error ?? "Generation failed");
        return;
      }
      router.push(`/training-setup/${planId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (!authReady) {
    return (
      <AthleteAppShell>
        <div className="flex min-h-[40vh] items-center justify-center text-gray-600">Loading…</div>
      </AthleteAppShell>
    );
  }

  return (
    <AthleteAppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="mb-2 text-sm text-gray-500">
          <Link href="/training-setup" className="text-orange-600 hover:underline">
            Training setup
          </Link>
          {" · "}
          <span className="text-gray-700">Plan generate test</span>
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Plan generate test</h1>
        <p className="mt-2 text-sm text-gray-600">
          Reads the same preset + rotations from the database that the generator uses (no schedule math).
          Use this on prod to verify the blueprint before generating.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-800">Plan</label>
            {loadingPlans ? (
              <p className="mt-2 text-sm text-gray-500">Loading plans…</p>
            ) : plans.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No plans found.</p>
            ) : (
              <select
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  setResult(null);
                  setError(null);
                }}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.lifecycleStatus ? ` · ${p.lifecycleStatus}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={testing || !planId || loadingPlans}
              onClick={() => void runPresetCheck()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {testing ? "Reading preset…" : "Test preset (read DB)"}
            </button>
            <button
              type="button"
              disabled={generating || !planId || loadingPlans}
              onClick={() => void runGenerate()}
              className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-900 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Regenerate schedule from preset"}
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-8 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
            <h2 className="text-lg font-semibold text-gray-900">What the service reads from the DB</h2>
            <p className="text-sm text-gray-800">
              <span className="font-medium">Plan:</span> {result.planName}
            </p>
            <p className="text-sm text-gray-800">
              <span className="font-medium">Preset on plan row:</span>{" "}
              {result.storedPresetId ?? (
                <span className="text-amber-800">null — coach must assign a blueprint</span>
              )}
            </p>
            <p className="text-sm text-gray-800">
              <span className="font-medium">Resolved preset:</span> {result.resolvedPresetId}
            </p>
            <p className="text-sm text-gray-800">
              <span className="font-medium">Blueprint:</span> {result.presetTitle}{" "}
              <span className="text-gray-500">({result.presetSlug})</span>
            </p>

            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <p className="font-semibold text-gray-900">Volume & long-run cycle</p>
              <p className="mt-2 text-gray-800">
                Base {result.baseMiles ?? "—"} mi → Peak {result.peakMiles ?? "—"} mi → Taper{" "}
                {result.taperMiles ?? "—"} mi · long-run cycle {result.cycleLen ?? "—"} weeks (
                {result.cycleLen ?? "—"} long runs before the rotation repeats)
              </p>
              <p className="mt-1 text-gray-700">
                Min weekly {result.minWeeklyMiles ?? "—"} mi · Max weekly {result.maxWeeklyMiles ?? "— (none)"}{" "}
                mi
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <p className="font-semibold text-gray-900">Ideal DOW</p>
              <p className="mt-2 text-gray-800">
                Tempo {dowLabel(result.tempoIdealDow)} · Intervals {dowLabel(result.intervalIdealDow)} · Long
                run {dowLabel(result.longRunDefaultDow)}
              </p>
            </div>

            <PositionBlock label="Long run positions" rows={result.positions.longRun} />
            <PositionBlock label="Intervals positions" rows={result.positions.intervals} />
            <PositionBlock label="Tempo positions" rows={result.positions.tempo} />
          </div>
        )}
      </div>
    </AthleteAppShell>
  );
}
