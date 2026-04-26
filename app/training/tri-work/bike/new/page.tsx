"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import api from "@/lib/api";
import {
  BikeStepEditor,
  buildBikeStepsApiPayload,
  defaultNewBikeSteps,
  type BikeStepDraft,
} from "@/components/training/BikeStepEditor";

export default function NewBikeWorkoutPage() {
  const router = useRouter();
  const [title, setTitle] = useState("Bike workout");
  const [date, setDate] = useState("");
  const [steps, setSteps] = useState<BikeStepDraft[]>(defaultNewBikeSteps);
  const [ftpWatts, setFtpWatts] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadFtp = useCallback(async () => {
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
      const ftp = (res.data as { athleteFtpWatts?: number | null })?.athleteFtpWatts;
      setFtpWatts(ftp ?? null);
    } catch {
      setFtpWatts(null);
    }
  }, []);

  useEffect(() => {
    void loadFtp();
  }, [loadFtp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const bodySteps = buildBikeStepsApiPayload(steps);

      const payload: Record<string, unknown> = {
        title: title.trim(),
        steps: bodySteps,
      };
      if (date.trim()) {
        payload.date = date.trim();
      }
      if (ftpWatts != null && ftpWatts > 0) {
        payload.ftpWattsSnapshot = ftpWatts;
      }

      const res = await api.post("/bike-workouts", payload);
      const id = (res.data as { bikeWorkout?: { id?: string } })?.bikeWorkout?.id;
      if (id) {
        router.push("/training/tri-work/bike");
        return;
      }
      setError("Unexpected response");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      setError(ax.response?.data?.error || (err instanceof Error ? err.message : "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/training/tri-work/bike" className="text-sm text-orange-600 hover:text-orange-700">
        ← Bike workouts
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">New bike workout</h1>

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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save workout"}
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
