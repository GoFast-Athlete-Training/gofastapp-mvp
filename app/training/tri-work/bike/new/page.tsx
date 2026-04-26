"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type StepDraft = {
  title: string;
  intensity: string;
  durationMinutes: string;
  powerWattsLow: string;
  powerWattsHigh: string;
};

const emptyStep = (): StepDraft => ({
  title: "Interval",
  intensity: "ACTIVE",
  durationMinutes: "10",
  powerWattsLow: "200",
  powerWattsHigh: "230",
});

export default function NewBikeWorkoutPage() {
  const router = useRouter();
  const [title, setTitle] = useState("Bike workout");
  const [date, setDate] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([
    {
      title: "Warmup",
      intensity: "WARMUP",
      durationMinutes: "10",
      powerWattsLow: "120",
      powerWattsHigh: "150",
    },
    emptyStep(),
    {
      title: "Cooldown",
      intensity: "COOLDOWN",
      durationMinutes: "10",
      powerWattsLow: "100",
      powerWattsHigh: "130",
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateStep(i: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
  }

  function removeStep(i: number) {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const bodySteps = steps.map((s, idx) => {
        const min = parseFloat(s.durationMinutes);
        if (!Number.isFinite(min) || min <= 0) {
          throw new Error(`Step ${idx + 1}: duration must be a positive number (minutes)`);
        }
        const low = parseInt(s.powerWattsLow, 10);
        const high = parseInt(s.powerWattsHigh, 10);
        if (!Number.isFinite(low) || !Number.isFinite(high)) {
          throw new Error(`Step ${idx + 1}: power must be watts (integers)`);
        }
        return {
          stepOrder: idx + 1,
          title: s.title.trim() || `Step ${idx + 1}`,
          intensity: s.intensity.trim() || "ACTIVE",
          durationType: "TIME",
          durationSeconds: Math.round(min * 60),
          powerWattsLow: low,
          powerWattsHigh: high,
        };
      });

      const payload: Record<string, unknown> = {
        title: title.trim(),
        steps: bodySteps,
      };
      if (date.trim()) {
        payload.date = date.trim();
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

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Steps (time + power)</p>
            <button
              type="button"
              onClick={addStep}
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Add step
            </button>
          </div>
          {steps.map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50/80">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs text-gray-500">Title</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={s.title}
                    onChange={(e) => updateStep(i, { title: e.target.value })}
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs text-gray-500">Intensity</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={s.intensity}
                    onChange={(e) => updateStep(i, { intensity: e.target.value })}
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-500">Minutes</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={s.durationMinutes}
                    onChange={(e) => updateStep(i, { durationMinutes: e.target.value })}
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-500">W low</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={s.powerWattsLow}
                    onChange={(e) => updateStep(i, { powerWattsLow: e.target.value })}
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-500">W high</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={s.powerWattsHigh}
                    onChange={(e) => updateStep(i, { powerWattsHigh: e.target.value })}
                  />
                </div>
                {steps.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="text-xs text-red-600 hover:underline pb-1"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

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
