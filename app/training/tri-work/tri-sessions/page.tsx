"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import api from "@/lib/api";

type LegSummary = {
  id: string;
  legOrder: number;
  sport: string;
  bikeWorkout?: { id: string; title: string } | null;
  swimWorkout?: { id: string; title: string } | null;
  runWorkout?: { id: string; title: string } | null;
};

type TriRow = {
  id: string;
  title: string;
  date: string | null;
  legs: LegSummary[];
};

export default function TriSessionsPage() {
  const [rows, setRows] = useState<TriRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await new Promise<void>((resolve) => {
        if (auth.currentUser) {
          resolve();
          return;
        }
        const unsub = onAuthStateChanged(auth, () => {
          unsub();
          resolve();
        });
      });
      const res = await api.get("/tri-workouts");
      const list = (res.data as { triWorkouts?: TriRow[] })?.triWorkouts;
      setRows(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      setRows(null);
      setError(e instanceof Error ? e.message : "Failed to load tri sessions");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pushAll(id: string) {
    setPushingId(id);
    setError(null);
    try {
      await api.post(`/tri-workouts/${id}/push-to-garmin`, {});
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string; legs?: unknown } } };
      setError(
        typeof ax.response?.data?.error === "string"
          ? ax.response.data.error
          : "Push failed (check swim legs — not supported yet)"
      );
    } finally {
      setPushingId(null);
    }
  }

  function legLabel(leg: LegSummary): string {
    if (leg.sport === "Bike" && leg.bikeWorkout) return `Bike: ${leg.bikeWorkout.title}`;
    if (leg.sport === "Run" && leg.runWorkout) return `Run: ${leg.runWorkout.title}`;
    if (leg.sport === "Swim" && leg.swimWorkout) return `Swim: ${leg.swimWorkout.title}`;
    return `${leg.sport}`;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Tri sessions</h1>
      <p className="text-gray-600 text-sm mb-6">
        Sessions link workouts you already created (bike + run). Create bike workouts first, run
        workouts from{" "}
        <a href="/workouts/create" className="text-orange-600 hover:text-orange-700 font-medium">
          Run workout builder
        </a>
        , then assemble a session via the API or Company dashboard until we add a composer here.
      </p>

      {error ? (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600 text-sm">No tri sessions yet.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-wrap items-start justify-between gap-3"
            >
              <div>
                <p className="font-semibold text-gray-900">{t.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t.date ? new Date(t.date).toLocaleDateString() : "No date"} ·{" "}
                  {(t.legs?.length ?? 0) || 0} legs
                </p>
                <ol className="mt-2 text-sm text-gray-700 list-decimal list-inside space-y-0.5">
                  {(t.legs ?? []).map((leg) => (
                    <li key={leg.id}>{legLabel(leg)}</li>
                  ))}
                </ol>
              </div>
              <button
                type="button"
                disabled={pushingId === t.id || !(t.legs?.length)}
                onClick={() => void pushAll(t.id)}
                className="text-sm font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50"
              >
                {pushingId === t.id ? "Pushing…" : "Push all to Garmin"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
