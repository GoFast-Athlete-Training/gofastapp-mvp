"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import {
  goalTimeHelperLine,
  isLongRaceGoalTimeFormat,
  parseGoalTimeToParts,
  validateAndAssembleGoalTime,
} from "@/lib/goal-time-input";

export type RaceForGoal = {
  id: string;
  name: string;
  raceDate: string;
  distanceLabel: string | null;
  /** When set, improves half+ detection when labels are nonstandard (e.g. \"MCM 8K\"). */
  distanceMeters?: number | null;
};

export type InlineGoalRow = {
  id: string;
  goalTime?: string | null;
  raceRegistryId?: string | null;
  race_registry?: { id: string } | null;
};

function raceCtx(race: RaceForGoal) {
  return {
    distanceLabel: race.distanceLabel,
    distanceMeters: race.distanceMeters ?? null,
  };
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
  const isLong = isLongRaceGoalTimeFormat(race.distanceLabel, race.distanceMeters ?? null);

  const parts = parseGoalTimeToParts(goal?.goalTime);
  const [h, setH] = useState(parts.h);
  const [m, setM] = useState(parts.m);
  const [s, setS] = useState(parts.s);
  const [expanded, setExpanded] = useState(!hasTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const secondsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = Boolean(goal?.goalTime?.trim());
    const p = parseGoalTimeToParts(goal?.goalTime);
    setH(p.h);
    setM(p.m);
    setS(p.s);
    setExpanded(!t);
  }, [goal?.id, goal?.goalTime]);

  function resetFromGoal() {
    const p = parseGoalTimeToParts(goal?.goalTime);
    setH(p.h);
    setM(p.m);
    setS(p.s);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateAndAssembleGoalTime(raceCtx(race), h, m, s);
    if (!v.ok) {
      setError(v.message);
      return;
    }
    if (!v.goalTime) {
      setError("Enter a finish time or clear all fields.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        goalTime: v.goalTime,
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

  const helper = goalTimeHelperLine(race.distanceLabel, race.distanceMeters ?? null);

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
      <p className="text-xs text-gray-600 mb-2 leading-snug">{helper}</p>

      {isLong ? (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-[4.5rem] sm:w-20">
            <label className="block text-xs text-gray-500 mb-1">Hours</label>
            <input
              ref={hoursRef}
              type="number"
              min={0}
              max={23}
              value={h}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 23)) {
                  setH(val);
                  if (val.length === 2 && minutesRef.current) minutesRef.current.focus();
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && minutesRef.current) {
                  e.preventDefault();
                  minutesRef.current.focus();
                }
              }}
              className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
            />
          </div>
          <span className="text-lg text-gray-400 pb-2">:</span>
          <div className="w-[4.5rem] sm:w-20">
            <label className="block text-xs text-gray-500 mb-1">Minutes</label>
            <input
              ref={minutesRef}
              type="number"
              min={0}
              max={59}
              value={m}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)) {
                  setM(val);
                  if (val.length === 2 && secondsRef.current) secondsRef.current.focus();
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && secondsRef.current) {
                  e.preventDefault();
                  secondsRef.current.focus();
                } else if (e.key === "Tab" && e.shiftKey && hoursRef.current) {
                  e.preventDefault();
                  hoursRef.current.focus();
                }
              }}
              className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
            />
          </div>
          <span className="text-lg text-gray-400 pb-2">:</span>
          <div className="w-[4.5rem] sm:w-20">
            <label className="block text-xs text-gray-500 mb-1">Seconds</label>
            <input
              ref={secondsRef}
              type="number"
              min={0}
              max={59}
              value={s}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)) {
                  setS(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Tab" && e.shiftKey && minutesRef.current) {
                  e.preventDefault();
                  minutesRef.current.focus();
                }
              }}
              className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-[4.5rem] sm:w-20">
            <label className="block text-xs text-gray-500 mb-1">Hours (optional)</label>
            <input
              ref={hoursRef}
              type="number"
              min={0}
              max={23}
              value={h}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 23)) {
                  setH(val);
                  if (val.length === 2 && minutesRef.current) minutesRef.current.focus();
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && minutesRef.current) {
                  e.preventDefault();
                  minutesRef.current.focus();
                }
              }}
              className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
            />
          </div>
          <span className="text-lg text-gray-400 pb-2">:</span>
          <div className="w-[4.5rem] sm:w-20">
            <label className="block text-xs text-gray-500 mb-1">Minutes</label>
            <input
              ref={minutesRef}
              type="number"
              min={0}
              max={59}
              value={m}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)) {
                  setM(val);
                  if (val.length === 2 && secondsRef.current) secondsRef.current.focus();
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && secondsRef.current) {
                  e.preventDefault();
                  secondsRef.current.focus();
                } else if (e.key === "Tab" && e.shiftKey && hoursRef.current) {
                  e.preventDefault();
                  hoursRef.current.focus();
                }
              }}
              className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
            />
          </div>
          <span className="text-lg text-gray-400 pb-2">:</span>
          <div className="w-[4.5rem] sm:w-20">
            <label className="block text-xs text-gray-500 mb-1">Seconds</label>
            <input
              ref={secondsRef}
              type="number"
              min={0}
              max={59}
              value={s}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)) {
                  setS(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Tab" && e.shiftKey && minutesRef.current) {
                  e.preventDefault();
                  minutesRef.current.focus();
                }
              }}
              className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-400"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
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
              resetFromGoal();
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
