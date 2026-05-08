"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export type RaceForGoal = {
  id: string;
  name: string;
  raceDate: string;
  distanceLabel: string | null;
};

export type InlineGoalRow = {
  id: string;
  goalTime?: string | null;
  raceRegistryId?: string | null;
  race_registry?: { id: string } | null;
};

function parseGoalTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

export function InlineGoalForm({
  race,
  goal,
  onSaved,
  className = "",
}: {
  race: RaceForGoal;
  goal: InlineGoalRow | null;
  onSaved: (updated: InlineGoalRow) => void;
  className?: string;
}) {
  const hasTime = Boolean(goal?.goalTime?.trim());
  const [input, setInput] = useState(goal?.goalTime?.trim() ?? "");
  const [expanded, setExpanded] = useState(!hasTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = Boolean(goal?.goalTime?.trim());
    setInput(goal?.goalTime?.trim() ?? "");
    setExpanded(!t);
  }, [goal?.id, goal?.goalTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseGoalTime(input);
    if (!parsed) {
      setError("Enter time as H:MM:SS (e.g. 1:45:00)");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        goalTime: parsed,
        raceRegistryId: race.id,
        name: race.name,
        distance: race.distanceLabel ?? undefined,
        targetByDate: race.raceDate,
      };
      let saved: InlineGoalRow;
      if (goal?.id) {
        const res = await api.put<{ goal: InlineGoalRow }>(`/goals/${goal.id}`, payload);
        saved = res.data.goal;
      } else {
        const res = await api.post<{ goal: InlineGoalRow }>(`/goals`, payload);
        saved = res.data.goal;
      }
      onSaved(saved);
      setExpanded(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed — try again";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (hasTime && !expanded) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span className="inline-flex items-center rounded-full border border-orange-200 bg-white px-3 py-1 text-sm font-mono font-semibold text-gray-900">
          Goal {goal!.goalTime!.trim()}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm font-semibold text-orange-700 hover:underline"
        >
          Update
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        Target finish time (H:MM:SS)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="1:45:00"
          maxLength={8}
          className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : hasTime ? "Save" : "Set goal"}
        </button>
        {hasTime ? (
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setError(null);
              setInput(goal?.goalTime?.trim() ?? "");
            }}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
