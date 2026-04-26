"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import api from "@/lib/api";
import {
  BikeStepEditor,
  bikeStepsFromApi,
  buildBikeStepsApiPayload,
  type BikeStepDraft,
} from "@/components/training/BikeStepEditor";

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function EditBikeWorkoutPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [steps, setSteps] = useState<BikeStepDraft[]>([]);
  const [ftpWatts, setFtpWatts] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
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
      const res = await api.get(`/bike-workouts/${id}`);
      const data = res.data as {
        bikeWorkout?: {
          title: string;
          date: string | null;
          steps: {
            title: string;
            intensity: string;
            durationSeconds: number | null;
            powerWattsLow: number | null;
            powerWattsHigh: number | null;
          }[];
        };
        athleteFtpWatts?: number | null;
      };
      const w = data.bikeWorkout;
      if (!w) {
        setError("Workout not found");
        return;
      }
      setTitle(w.title);
      setDate(toDateInputValue(w.date ?? undefined));
      setFtpWatts(data.athleteFtpWatts ?? null);
      setSteps(
        w.steps?.length
          ? bikeStepsFromApi(w.steps, data.athleteFtpWatts)
          : [
              {
                title: "Step",
                intensity: "ACTIVE",
                durationMinutes: "10",
                powerWattsLow: "",
                powerWattsHigh: "",
                powerPctLow: "",
                powerPctHigh: "",
              },
            ]
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load workout");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSaving(true);
    try {
      const bodySteps = buildBikeStepsApiPayload(steps);
      const payload: Record<string, unknown> = {
        title: title.trim(),
        steps: bodySteps,
      };
      payload.date = date.trim() ? date.trim() : null;
      if (ftpWatts != null && ftpWatts > 0) {
        payload.ftpWattsSnapshot = ftpWatts;
      }

      await api.patch(`/bike-workouts/${id}`, payload);
      router.push("/training/tri-work/bike");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      setError(ax.response?.data?.error || (err instanceof Error ? err.message : "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function pushGarmin() {
    if (!id) return;
    setPushing(true);
    setError(null);
    try {
      await api.post(`/bike-workouts/${id}/push-to-garmin`, {});
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string; details?: string } } };
      setError(ax.response?.data?.details || ax.response?.data?.error || "Push failed");
    } finally {
      setPushing(false);
    }
  }

  if (!id) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Invalid workout id
      </p>
    );
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading…</p>;
  }

  return (
    <div className="max-w-2xl">
      <Link href="/training/tri-work/bike" className="text-sm text-orange-600 hover:text-orange-700">
        ← Bike workouts
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">Edit bike workout</h1>

      <form onSubmit={(e) => void submit(e)} className="space-y-6">
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date (optional)</label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <BikeStepEditor steps={steps} onChangeSteps={setSteps} ftpWatts={ftpWatts} />

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={pushing || !steps.length}
            onClick={() => void pushGarmin()}
            className="rounded-lg border border-orange-600 px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50 disabled:opacity-50"
          >
            {pushing ? "Pushing…" : "Push to Garmin"}
          </button>
          <Link
            href="/training/tri-work/bike"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
