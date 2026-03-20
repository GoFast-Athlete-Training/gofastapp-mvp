"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LocalStorageAPI } from "@/lib/localstorage";
import TopNav from "@/components/shared/TopNav";
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

type AthleteGoalRow = {
  id: string;
  athleteId: string;
  distance: string;
  goalTime: string | null;
  goalRacePace: number | null;
  goalPace5K: number | null;
  raceRegistryId: string | null;
  targetByDate: string;
  status: string;
  race_registry?: RaceRegistry | null;
};

function formatSecPerMile(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

export default function RaceGoalPage() {
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [goal, setGoal] = useState<AthleteGoalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [raceSearchQuery, setRaceSearchQuery] = useState("");
  const [raceSearchResults, setRaceSearchResults] = useState<RaceRegistry[]>([]);
  const [searchingRaces, setSearchingRaces] = useState(false);
  const [selectedRace, setSelectedRace] = useState<RaceRegistry | null>(null);
  const [goalTime, setGoalTime] = useState("");
  const [goalPace5K, setGoalPace5K] = useState("");

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (id) setAthleteId(id);
  }, []);

  useEffect(() => {
    if (!athleteId) {
      setLoading(false);
      return;
    }
    api
      .get<{ goals: AthleteGoalRow[] }>(`/goals?status=ACTIVE`)
      .then((res) => {
        const list = res.data?.goals ?? [];
        const g = list[0] ?? null;
        setGoal(g);
        if (g) {
          setGoalTime(g.goalTime ?? "");
          setGoalPace5K(
            g.goalPace5K != null ? formatSecPerMile(g.goalPace5K) : ""
          );
          if (g.race_registry) setSelectedRace(g.race_registry);
        }
      })
      .catch(() => setError("Failed to load race goal"))
      .finally(() => setLoading(false));
  }, [athleteId]);

  const searchRaces = async () => {
    if (!raceSearchQuery.trim()) return;
    setSearchingRaces(true);
    try {
      const res = await api.post<{ success: boolean; race_registry?: RaceRegistry[] }>("/api/race/search", {
        query: raceSearchQuery.trim(),
      });
      const list = res.data?.race_registry ?? [];
      setRaceSearchResults(list);
    } catch {
      setRaceSearchResults([]);
    } finally {
      setSearchingRaces(false);
    }
  };

  const handleSave = async () => {
    if (!athleteId) return;
    setSaving(true);
    setError(null);
    try {
      const targetByDate = selectedRace?.raceDate
        ? new Date(selectedRace.raceDate).toISOString()
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const distance =
        selectedRace?.raceType?.trim() ||
        goal?.distance ||
        "5k";

      if (goal?.id) {
        const res = await api.put<{ goal: AthleteGoalRow }>(`/goals/${goal.id}`, {
          raceRegistryId: selectedRace?.id ?? null,
          goalTime: goalTime.trim() || null,
          distance,
          targetByDate,
        });
        setGoal(res.data.goal);
        if (res.data.goal.goalPace5K != null) {
          setGoalPace5K(formatSecPerMile(res.data.goal.goalPace5K));
        }
      } else {
        const res = await api.post<{ goal: AthleteGoalRow }>(`/goals`, {
          distance,
          goalTime: goalTime.trim() || null,
          raceRegistryId: selectedRace?.id ?? null,
          targetByDate,
        });
        setGoal(res.data.goal);
        if (res.data.goal.goalPace5K != null) {
          setGoalPace5K(formatSecPerMile(res.data.goal.goalPace5K));
        }
      }
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
        : "Failed to save";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !athleteId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-gray-600">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Race goal</h1>
        <p className="text-gray-600 mb-6">
          Set your goal race and target time. GoFast uses this to personalize workout suggestions.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Goal race search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal race</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={raceSearchQuery}
                onChange={(e) => setRaceSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchRaces()}
                placeholder="Search by race name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <button
                type="button"
                onClick={searchRaces}
                disabled={searchingRaces}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium disabled:opacity-50"
              >
                {searchingRaces ? "Searching…" : "Search"}
              </button>
            </div>
            {raceSearchResults.length > 0 && (
              <ul className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
                {raceSearchResults.map((race) => (
                  <li key={race.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRace(race);
                        setRaceSearchQuery("");
                        setRaceSearchResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-orange-50 text-sm"
                    >
                      {race.name} — {race.distanceMiles} mi · {race.city ?? ""} {race.state ?? ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedRace && (
              <p className="mt-2 text-sm text-gray-700">
                Selected: <strong>{selectedRace.name}</strong> ({selectedRace.distanceMiles} mi)
                <button
                  type="button"
                  onClick={() => setSelectedRace(null)}
                  className="ml-2 text-orange-600 hover:text-orange-800"
                >
                  Clear
                </button>
              </p>
            )}
          </div>

          {/* Goal time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal time</label>
            <input
              type="text"
              value={goalTime}
              onChange={(e) => setGoalTime(e.target.value)}
              placeholder="e.g. 3:30:00 or 22:00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <p className="mt-1 text-xs text-gray-500">Use H:MM:SS for marathon/half or MM:SS for 5k/10k</p>
          </div>

          {/* Derived equivalent 5K pace (read-only after save) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equivalent goal 5K pace (derived)
            </label>
            <input
              type="text"
              value={goalPace5K}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500">
              Computed from your goal time and distance when you save.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </main>
    </div>
  );
}
