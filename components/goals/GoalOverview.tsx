"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

type RaceRegistry = {
  id: string;
  name: string;
  raceType: string;
  distanceMiles: number;
  raceDate: string;
  city?: string | null;
  state?: string | null;
};

type GoalRow = {
  id: string;
  name?: string | null;
  distance: string;
  goalTime: string | null;
  goalRacePace: number | null;
  targetByDate: string;
  whyGoal?: string | null;
  successLooksLike?: string | null;
  completionFeeling?: string | null;
  motivationIcon?: string | null;
  race_registry?: RaceRegistry | null;
};

function formatSecPerMile(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function mindsetIsEmpty(g: GoalRow): boolean {
  return !(
    (g.whyGoal?.trim() ?? "") ||
    (g.successLooksLike?.trim() ?? "") ||
    (g.completionFeeling?.trim() ?? "") ||
    (g.motivationIcon?.trim() ?? "")
  );
}

export default function GoalOverview() {
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ goals: GoalRow[] }>("/goals?status=ACTIVE")
      .then((res) => {
        const list = res.data?.goals ?? [];
        setGoal(list[0] ?? null);
      })
      .catch(() => setError("Could not load your goal."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 text-sm">{error}</p>;
  }

  if (!goal) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your goal</h1>
        <p className="text-gray-600 mb-6">
          Set a race or distance target so training zones and plans align with what you are chasing.
        </p>
        <Link
          href="/goals/target"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          Set race & target
        </Link>
      </div>
    );
  }

  const title =
    goal.name?.trim() ||
    goal.race_registry?.name ||
    goal.race_registry?.raceType ||
    goal.distance;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Your goal</h1>
      <p className="text-sm text-gray-600 mb-6">Active training target and motivation.</p>

      {mindsetIsEmpty(goal) ? (
        <p className="text-sm text-amber-900/90 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
          Add a few lines about{" "}
          <Link href="/goals/mindset" className="font-semibold text-orange-700 underline-offset-2 hover:underline">
            why this goal matters
          </Link>{" "}
          — it helps on hard training days.
        </p>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-3 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {goal.race_registry ? (
          <p className="text-sm text-gray-600">
            {goal.race_registry.city || goal.race_registry.state
              ? [goal.race_registry.city, goal.race_registry.state].filter(Boolean).join(", ")
              : null}
            {goal.race_registry.raceDate ? (
              <span className="block mt-1">Race day: {formatDate(goal.race_registry.raceDate)}</span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-gray-600">Target date: {formatDate(goal.targetByDate)}</p>
        )}
        {goal.goalTime?.trim() ? (
          <p className="text-sm text-gray-800">
            Goal time: <span className="font-medium">{goal.goalTime.trim()}</span>
            {goal.goalRacePace != null ? (
              <span className="text-gray-600"> ({formatSecPerMile(goal.goalRacePace)} avg)</span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-gray-500">No goal finish time set yet.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/goals/target"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          Edit race & target
        </Link>
        <Link
          href="/goals/mindset"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Mindset & motivation
        </Link>
      </div>
    </div>
  );
}
