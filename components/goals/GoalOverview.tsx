"use client";

import { useEffect, useState, useCallback } from "react";
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
  description?: string | null;
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

function hasRaceOrTarget(g: GoalRow): boolean {
  return Boolean(
    g.race_registry ||
      g.goalTime?.trim() ||
      (g.distance?.trim() && g.distance.trim() !== "")
  );
}

type GoalOverviewProps = {
  /** Hidden route: name/description only; no primary nav. Requires an active goal from the main Goals (race) flow. */
  variant?: "identity";
};

export default function GoalOverview({ variant }: GoalOverviewProps) {
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const loadGoal = useCallback(() => {
    return api
      .get<{ goals: GoalRow[] }>("/goals?status=ACTIVE")
      .then((res) => {
        const list = res.data?.goals ?? [];
        const g = list[0] ?? null;
        setGoal(g);
        if (g) {
          setDraftName(g.name?.trim() ?? "");
          setDraftDescription(g.description?.trim() ?? "");
        }
        return g;
      })
      .catch(() => {
        setError("Could not load your goal.");
        return null;
      });
  }, []);

  useEffect(() => {
    loadGoal().finally(() => setLoading(false));
  }, [loadGoal]);

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal?.id) return;
    const name = draftName.trim();
    if (!name) {
      setSaveError("Goal name cannot be empty.");
      return;
    }
    setSaveError(null);
    setSaving(true);
    setSavedFlash(false);
    try {
      await api.put(`/goals/${goal.id}`, {
        name,
        description: draftDescription.trim() || null,
      });
      await loadGoal();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch {
      setSaveError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Goal name &amp; notes</h1>
        <p className="text-sm text-gray-600 mb-4">
          {variant === "identity"
            ? "Set your race on the main Goals page first. Then you can add an optional display name and description here."
            : "Pick your race on Goals to create an active goal."}
        </p>
        <Link
          href="/goals"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          Go to Goals
        </Link>
      </div>
    );
  }

  const displayTitle = draftName.trim() || "Your goal";

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayTitle}</h1>
      <p className="text-sm text-gray-600 mb-6">
        Optional display name and notes. Your race and finish time are set on{" "}
        <Link href="/goals" className="text-orange-700 font-medium hover:underline">
          Goals
        </Link>
        .
      </p>

      <form onSubmit={handleSaveIdentity} className="space-y-4 mb-8">
        <div>
          <label htmlFor="goal-name" className="block text-sm font-medium text-gray-800 mb-1">
            Goal name
          </label>
          <input
            id="goal-name"
            type="text"
            value={draftName}
            onChange={(e) => {
              setDraftName(e.target.value);
              setSaveError(null);
              setSavedFlash(false);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="goal-desc" className="block text-sm font-medium text-gray-800 mb-1">
            Description <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <textarea
            id="goal-desc"
            value={draftDescription}
            onChange={(e) => {
              setDraftDescription(e.target.value);
              setSavedFlash(false);
            }}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
        {savedFlash ? <p className="text-sm text-green-700">Saved.</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Race & target</p>
              {hasRaceOrTarget(goal) ? (
                <div className="mt-2 text-sm text-gray-800 space-y-1">
                  {goal.race_registry ? (
                    <>
                      <p className="font-medium">{goal.race_registry.name}</p>
                      {(goal.race_registry.city || goal.race_registry.state) && (
                        <p className="text-gray-600">
                          {[goal.race_registry.city, goal.race_registry.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                      <p className="text-gray-600">Race day: {formatDate(goal.race_registry.raceDate)}</p>
                    </>
                  ) : (
                    <p className="text-gray-700">Target date: {formatDate(goal.targetByDate)}</p>
                  )}
                  {goal.goalTime?.trim() ? (
                    <p>
                      Goal time: <span className="font-medium">{goal.goalTime.trim()}</span>
                      {goal.goalRacePace != null ? (
                        <span className="text-gray-600"> ({formatSecPerMile(goal.goalRacePace)} avg)</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-gray-500">No finish time set yet.</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-600">
                  Add a race or distance and optional time goal so training lines up with race day.
                </p>
              )}
            </div>
            <Link
              href="/goals"
              className="shrink-0 text-sm font-semibold text-orange-700 hover:text-orange-800 underline-offset-2 hover:underline"
            >
              {hasRaceOrTarget(goal) ? "Edit race" : "Set up"}
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mindset</p>
              {mindsetIsEmpty(goal) ? (
                <p className="mt-2 text-sm text-gray-600">
                  Not filled in yet — add why this matters when you have a minute.
                </p>
              ) : (
                <p className="mt-2 text-sm text-green-800 font-medium">You&apos;ve added mindset notes.</p>
              )}
            </div>
            <Link
              href="/goals/mindset"
              className="shrink-0 text-sm font-semibold text-orange-700 hover:text-orange-800 underline-offset-2 hover:underline"
            >
              {mindsetIsEmpty(goal) ? "Add" : "Edit"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
