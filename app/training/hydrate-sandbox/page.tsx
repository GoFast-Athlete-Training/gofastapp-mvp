"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import type { TrainingHydrateSnapshot } from "@/lib/training/training-hydrate-service";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium tabular-nums text-gray-900 text-right">{value ?? "—"}</dd>
    </div>
  );
}

export default function TrainingHydrateSandboxPage() {
  const [snapshot, setSnapshot] = useState<TrainingHydrateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ ok?: boolean; snapshot?: TrainingHydrateSnapshot; error?: string }>(
        "/training/hydrate"
      );
      if (res.data?.error) throw new Error(res.data.error);
      setSnapshot(res.data?.snapshot ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load hydrate");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      void load();
    });
    return () => unsub();
  }, [load]);

  async function applyAdaptive() {
    setApplying(true);
    setApplyMessage(null);
    try {
      const res = await api.post<{
        ok?: boolean;
        applyResult?: { applied: boolean; reason: string };
        snapshot?: TrainingHydrateSnapshot;
        error?: string;
      }>("/training/hydrate", { applyAdaptive: true });
      if (res.data?.error) throw new Error(res.data.error);
      setSnapshot(res.data?.snapshot ?? null);
      setApplyMessage(res.data?.applyResult?.reason ?? "Done");
    } catch (e: unknown) {
      setApplyMessage(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  const diff = snapshot?.differenceToGoal;
  const miles = snapshot?.planMiles;
  const adaptive = snapshot?.lightAdaptive;

  return (
    <AthleteAppShell>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Training Hydrate Sandbox</h1>
            <p className="mt-1 text-sm text-gray-600">
              Raw hydrate snapshot + light adaptive evaluation for MVP testing.
            </p>
          </div>
          <Link
            href="/training"
            className="text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            ← Training Hub
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void applyAdaptive()}
            disabled={applying || !adaptive?.wouldUpdate}
            className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
          >
            {applying ? "Applying…" : "Apply light adaptive"}
          </button>
        </div>

        {applyMessage ? (
          <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
            {applyMessage}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !snapshot ? (
          <p className="text-sm text-gray-500">No snapshot.</p>
        ) : (
          <>
            <section className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-800">
                Goal & predictor
              </h2>
              <dl className="mt-3">
                <Row label="Goal race" value={snapshot.goalRace?.name} />
                <Row label="Goal finish" value={snapshot.goalFinishTime} />
                <Row label="Goal pace" value={snapshot.goalPace} />
                <Row label="Current 5K" value={snapshot.current5k} />
                <Row label="Projected race pace" value={snapshot.currentRacePace} />
                <Row label="Projected finish" value={snapshot.currentProjectedFinish} />
                <Row label="Gap" value={diff?.finishDeltaLabel ?? diff?.paceDeltaLabel} />
              </dl>
            </section>

            <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Plan miles
              </h2>
              <dl className="mt-3">
                <Row
                  label="Completed"
                  value={miles ? `${miles.completedMiles} mi` : null}
                />
                <Row
                  label="Planned to date"
                  value={miles ? `${miles.plannedToDateMiles} mi` : null}
                />
                <Row
                  label="Remaining scheduled"
                  value={miles ? `${miles.remainingScheduledMiles} mi` : null}
                />
                <Row
                  label="Workouts completed"
                  value={
                    miles
                      ? `${miles.completedWorkouts} / ${miles.plannedWorkoutsToDate} to date`
                      : null
                  }
                />
                <Row label="Under plan" value={miles?.underPlanMessage} />
              </dl>
            </section>

            <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-800">
                Light adaptive
              </h2>
              <dl className="mt-3">
                <Row label="Eligible" value={adaptive?.eligible ? "Yes" : "No"} />
                <Row label="Would update 5K" value={adaptive?.wouldUpdate ? "Yes" : "No"} />
                <Row label="Reason" value={adaptive?.reason} />
                <Row
                  label="Long run target met"
                  value={adaptive?.longRunTargetMet ? "Yes" : "No"}
                />
                <Row
                  label="Completed miles"
                  value={adaptive != null ? `${adaptive.completedMiles} mi` : null}
                />
              </dl>
            </section>

            <details className="rounded-xl border border-gray-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                Raw JSON
              </summary>
              <pre className="mt-3 overflow-x-auto text-xs text-gray-700">
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </AthleteAppShell>
  );
}
