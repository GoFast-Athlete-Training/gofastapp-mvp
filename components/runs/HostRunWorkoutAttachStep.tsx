"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type PlanDay = {
  dateKey: string;
  plannedWorkoutId: string;
  title: string;
  workoutType: string | null;
};

type Props = {
  selectedPlannedWorkoutId: string | null;
  onSelectPlannedWorkoutId: (id: string | null) => void;
  selectedWorkoutId: string | null;
  onSelectWorkoutId: (id: string | null) => void;
  paceBand: string;
  onPaceBandChange: (v: string) => void;
  miles: string;
  onMilesChange: (v: string) => void;
};

/**
 * Miles / distance step: pace+miles mash, plan day, or tailored workout id (existing workout).
 */
export default function HostRunWorkoutAttachStep({
  selectedPlannedWorkoutId,
  onSelectPlannedWorkoutId,
  selectedWorkoutId,
  onSelectWorkoutId,
  paceBand,
  onPaceBandChange,
  miles,
  onMilesChange,
}: Props) {
  const [mode, setMode] = useState<"pace" | "plan" | "workout">("pace");
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [workouts, setWorkouts] = useState<
    Array<{ id: string; title: string | null; workoutType: string | null }>
  >([]);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => {
    if (mode !== "plan") return;
    setLoadingPlan(true);
    void (async () => {
      try {
        const { data } = await api.get<{
          sessions?: Array<{
            date: string;
            plannedWorkoutId?: string | null;
            title: string;
            workoutType?: string | null;
            isPlanSession?: boolean;
          }>;
        }>("/training/upcoming");
        const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
        setPlanDays(
          sessions
            .filter((d) => d.isPlanSession && d.plannedWorkoutId)
            .map((d) => ({
              dateKey: d.date.slice(0, 10),
              plannedWorkoutId: d.plannedWorkoutId as string,
              title: d.title,
              workoutType: d.workoutType ?? null,
            })),
        );
      } catch {
        setPlanDays([]);
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [mode]);

  useEffect(() => {
    if (mode !== "workout") return;
    void (async () => {
      try {
        const { data } = await api.get<{
          workouts?: Array<{ id: string; title: string | null; workoutType: string | null }>;
        }>("/workouts");
        setWorkouts(Array.isArray(data?.workouts) ? data.workouts : []);
      } catch {
        setWorkouts([]);
      }
    })();
  }, [mode]);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Miles / workout (optional)
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pace", "Add pace / miles"],
            ["workout", "Tailored workout"],
            ["plan", "My plan"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              if (id === "pace") {
                onSelectPlannedWorkoutId(null);
                onSelectWorkoutId(null);
              }
              if (id === "plan") onSelectWorkoutId(null);
              if (id === "workout") onSelectPlannedWorkoutId(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold border ${
              mode === id
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-white text-gray-800 border-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "pace" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Miles</label>
            <input
              type="number"
              step={0.1}
              min={0}
              value={miles}
              onChange={(e) => onMilesChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pace band</label>
            <input
              type="text"
              value={paceBand}
              onChange={(e) => onPaceBandChange(e.target.value)}
              placeholder="e.g. 8:30–9:00 / mi easy"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      ) : null}

      {mode === "plan" ? (
        loadingPlan ? (
          <p className="text-sm text-gray-500">Loading plan…</p>
        ) : planDays.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming plan days with workouts.</p>
        ) : (
          <select
            value={selectedPlannedWorkoutId ?? ""}
            onChange={(e) => onSelectPlannedWorkoutId(e.target.value || null)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Pick a plan day…</option>
            {planDays.map((d) => (
              <option key={d.plannedWorkoutId} value={d.plannedWorkoutId}>
                {d.dateKey} — {d.title}
              </option>
            ))}
          </select>
        )
      ) : null}

      {mode === "workout" ? (
        <select
          value={selectedWorkoutId ?? ""}
          onChange={(e) => onSelectWorkoutId(e.target.value || null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Pick a workout…</option>
          {workouts.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title?.trim() || w.workoutType || "Workout"}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
