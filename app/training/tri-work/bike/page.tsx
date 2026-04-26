"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import api from "@/lib/api";

type BikeStep = {
  id: string;
  stepOrder: number;
  title: string;
  durationSeconds: number | null;
  powerWattsLow: number | null;
  powerWattsHigh: number | null;
};

type BikeRow = {
  id: string;
  title: string;
  date: string | null;
  steps: BikeStep[];
  garminWorkoutId: number | null;
};

export default function TriWorkBikeListPage() {
  const [rows, setRows] = useState<BikeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await new Promise<void>((resolve) => {
        const u = auth.currentUser;
        if (u) {
          resolve();
          return;
        }
        const unsub = onAuthStateChanged(auth, () => {
          unsub();
          resolve();
        });
      });
      const res = await api.get("/bike-workouts");
      const list = (res.data as { bikeWorkouts?: BikeRow[] })?.bikeWorkouts;
      setRows(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      setRows(null);
      setError(e instanceof Error ? e.message : "Failed to load bike workouts");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pushGarmin(id: string) {
    setPushingId(id);
    setError(null);
    try {
      await api.post(`/bike-workouts/${id}/push-to-garmin`, {});
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string; details?: string } } };
      setError(ax.response?.data?.details || ax.response?.data?.error || "Push failed");
    } finally {
      setPushingId(null);
    }
  }

  async function deleteWorkout(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setDeletingId(id);
    setError(null);
    try {
      await api.delete(`/bike-workouts/${id}`);
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { error?: string } } };
      const status = ax.response?.status;
      const msg =
        ax.response?.data?.error ||
        (status === 409
          ? "Remove this workout from its tri session before deleting."
          : "Delete failed");
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bike workouts</h1>
        <Link
          href="/training/tri-work/bike/new"
          className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          New bike workout
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600 text-sm">
          No bike workouts yet. Create one with power targets (watts) and time-based steps.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((w) => {
            const dur =
              w.steps?.reduce((s, x) => s + (x.durationSeconds ?? 0), 0) ?? 0;
            const durMin = dur > 0 ? Math.round(dur / 60) : null;
            return (
              <li
                key={w.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-wrap items-start justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-gray-900">{w.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {w.date ? new Date(w.date).toLocaleDateString() : "No date"} ·{" "}
                    {w.steps?.length ?? 0} steps
                    {durMin != null ? ` · ~${durMin} min` : ""}
                    {w.garminWorkoutId != null ? ` · Garmin #${w.garminWorkoutId}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/training/tri-work/bike/${w.id}`}
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={pushingId === w.id || !(w.steps?.length)}
                    onClick={() => void pushGarmin(w.id)}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50"
                  >
                    {pushingId === w.id ? "Pushing…" : "Push to Garmin"}
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === w.id}
                    onClick={() => void deleteWorkout(w.id, w.title)}
                    className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {deletingId === w.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
