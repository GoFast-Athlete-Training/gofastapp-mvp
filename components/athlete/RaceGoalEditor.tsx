"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";
import { deriveGoalPaces } from "@/lib/pace-utils";

export type RaceGoalEditorVariant = "settings" | "onboarding";

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

const CUSTOM_RACE_TYPES = [
  { value: "5k", label: "5K" },
  { value: "10k", label: "10K" },
  { value: "10m", label: "10 mile" },
  { value: "half", label: "Half marathon" },
  { value: "marathon", label: "Marathon" },
  { value: "ultra", label: "Ultra" },
] as const;

function formatSecPerMile(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mile`;
}

function mapApiRaceToRegistry(r: {
  id: string;
  name: string;
  raceType: string;
  distanceMiles: number;
  raceDate: string | Date;
  city?: string | null;
  state?: string | null;
}): RaceRegistry {
  const d =
    typeof r.raceDate === "string"
      ? r.raceDate
      : new Date(r.raceDate).toISOString();
  return {
    id: r.id,
    name: r.name,
    raceType: r.raceType,
    distanceMiles: r.distanceMiles,
    raceDate: d,
    city: r.city,
    state: r.state,
  };
}

export default function RaceGoalEditor({
  variant,
}: {
  variant: RaceGoalEditorVariant;
}) {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [goal, setGoal] = useState<AthleteGoalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [raceSearchQuery, setRaceSearchQuery] = useState("");
  const [raceSearchResults, setRaceSearchResults] = useState<RaceRegistry[]>([]);
  const [searchingRaces, setSearchingRaces] = useState(false);
  const [searchCompletedEmpty, setSearchCompletedEmpty] = useState(false);
  const [selectedRace, setSelectedRace] = useState<RaceRegistry | null>(null);
  const [goalTime, setGoalTime] = useState("");
  const [goalPace5K, setGoalPace5K] = useState("");

  const [showCustomRaceForm, setShowCustomRaceForm] = useState(false);
  const [newRaceName, setNewRaceName] = useState("");
  const [newRaceDate, setNewRaceDate] = useState("");
  const [newRaceDistance, setNewRaceDistance] = useState<string>("5k");
  const [newRaceCity, setNewRaceCity] = useState("");
  const [newRaceState, setNewRaceState] = useState("");
  const [creatingRace, setCreatingRace] = useState(false);

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

  const livePaces = useMemo(() => {
    if (!selectedRace || !goalTime.trim()) return null;
    const distance =
      selectedRace.raceType?.trim() || goal?.distance || "5k";
    try {
      const { goalRacePace, goalPace5K: g5 } = deriveGoalPaces({
        distance,
        goalTime,
        distanceMiles: selectedRace.distanceMiles,
      });
      if (goalRacePace == null || g5 == null) return null;
      return { goalRacePace, goalPace5K: g5 };
    } catch {
      return null;
    }
  }, [selectedRace, goalTime, goal?.distance]);

  const searchRaces = async () => {
    if (!raceSearchQuery.trim()) return;
    setSearchingRaces(true);
    setSearchCompletedEmpty(false);
    try {
      const res = await api.post<{
        success: boolean;
        race_registry?: RaceRegistry[];
      }>("/race/search", {
        query: raceSearchQuery.trim(),
      });
      const list = res.data?.race_registry ?? [];
      setRaceSearchResults(list);
      setSearchCompletedEmpty(list.length === 0);
    } catch {
      setRaceSearchResults([]);
      setSearchCompletedEmpty(true);
    } finally {
      setSearchingRaces(false);
    }
  };

  const handleCreateCustomRace = async () => {
    if (!newRaceName.trim() || !newRaceDate) {
      setError("Race name and date are required");
      return;
    }
    setCreatingRace(true);
    setError(null);
    try {
      const response = await api.post<{
        success: boolean;
        race?: {
          id: string;
          name: string;
          raceType: string;
          distanceMiles: number;
          raceDate: string | Date;
          city?: string | null;
          state?: string | null;
        };
        error?: string;
      }>("/race/create", {
        name: newRaceName.trim(),
        raceType: newRaceDistance,
        date: newRaceDate,
        city: newRaceCity.trim() || null,
        state: newRaceState.trim() || null,
        country: "USA",
      });

      if (response.data.success && response.data.race) {
        const mapped = mapApiRaceToRegistry(response.data.race);
        setSelectedRace(mapped);
        setRaceSearchQuery("");
        setRaceSearchResults([]);
        setShowCustomRaceForm(false);
        setNewRaceName("");
        setNewRaceDate("");
        setNewRaceCity("");
        setNewRaceState("");
      } else {
        setError(response.data.error || "Failed to create race");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setError(msg || "Failed to create race");
    } finally {
      setCreatingRace(false);
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
        selectedRace?.raceType?.trim() || goal?.distance || "5k";

      if (goal?.id) {
        const res = await api.put<{ goal: AthleteGoalRow }>(
          `/goals/${goal.id}`,
          {
            raceRegistryId: selectedRace?.id ?? null,
            goalTime: goalTime.trim() || null,
            distance,
            targetByDate,
          }
        );
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

      if (variant === "onboarding") {
        router.push("/athlete-home");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : "Failed to save";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !athleteId) {
    return (
      <div>
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  const isOnboarding = variant === "onboarding";

  return (
    <div>
      {!isOnboarding && (
        <Link
          href="/athlete-home"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to dashboard
        </Link>
      )}

      {isOnboarding && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Link
            href="/athlete-home"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Skip for now
          </Link>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {isOnboarding ? "Set your race goal" : "Race goal"}
      </h1>
      <p className="text-gray-600 mb-6">
        {isOnboarding
          ? "Optional — add a goal race and target time so we can personalize your training. You can always do this later in Settings."
          : "Set your goal race and target time. GoFast uses this to personalize workout suggestions."}
      </p>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Goal race
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={raceSearchQuery}
              onChange={(e) => {
                setRaceSearchQuery(e.target.value);
                setSearchCompletedEmpty(false);
              }}
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
                      setShowCustomRaceForm(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-orange-50 text-sm"
                  >
                    {race.name} — {race.distanceMiles} mi · {race.city ?? ""}{" "}
                    {race.state ?? ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchCompletedEmpty && !searchingRaces && (
            <p className="mt-2 text-sm text-gray-500">
              No matches. Try another search or add your race below.
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowCustomRaceForm((v) => !v)}
            className="mt-3 text-sm font-medium text-orange-600 hover:text-orange-800"
          >
            {showCustomRaceForm
              ? 'Hide "my race is not listed"'
              : "My race is not listed — add it"}
          </button>

          {showCustomRaceForm && (
            <div className="mt-4 p-4 rounded-lg border border-orange-100 bg-orange-50/50 space-y-3">
              <p className="text-sm text-gray-700">
                We&apos;ll save this race so you can pick it for your goal.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Race name
                </label>
                <input
                  type="text"
                  value={newRaceName}
                  onChange={(e) => setNewRaceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Race date
                </label>
                <input
                  type="date"
                  value={newRaceDate}
                  onChange={(e) => setNewRaceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Distance
                </label>
                <select
                  value={newRaceDistance}
                  onChange={(e) => setNewRaceDistance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {CUSTOM_RACE_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    City (optional)
                  </label>
                  <input
                    type="text"
                    value={newRaceCity}
                    onChange={(e) => setNewRaceCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    State (optional)
                  </label>
                  <input
                    type="text"
                    value={newRaceState}
                    onChange={(e) => setNewRaceState(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCreateCustomRace}
                disabled={creatingRace}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {creatingRace ? "Saving race…" : "Add race & select"}
              </button>
            </div>
          )}

          {selectedRace && (
            <p className="mt-2 text-sm text-gray-700">
              Selected: <strong>{selectedRace.name}</strong> (
              {selectedRace.distanceMiles} mi)
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Goal time
          </label>
          <input
            type="text"
            value={goalTime}
            onChange={(e) => setGoalTime(e.target.value)}
            placeholder="e.g. 3:30:00 or 22:00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Use H:MM:SS for marathon/half or MM:SS for 5k/10k
          </p>
          {livePaces && (
            <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-sm text-gray-800">
              <p>
                Goal pace ~{" "}
                <span className="font-semibold">
                  {formatSecPerMile(livePaces.goalRacePace)}
                </span>
              </p>
              <p className="text-gray-600 mt-0.5">
                Equivalent 5K pace ~{" "}
                <span className="font-medium">
                  {formatSecPerMile(livePaces.goalPace5K)}
                </span>
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Equivalent goal 5K pace (saved)
          </label>
          <input
            type="text"
            value={goalPace5K}
            readOnly
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500">
            Confirmed values appear here after you save.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : isOnboarding ? "Save & continue" : "Save"}
        </button>
      </div>
    </div>
  );
}
