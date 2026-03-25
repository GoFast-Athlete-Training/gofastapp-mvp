"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";
import { deriveGoalPaces } from "@/lib/pace-utils";

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
  name?: string | null;
  distance: string;
  goalTime: string | null;
  goalRacePace: number | null;
  goalPace5K: number | null;
  raceRegistryId: string | null;
  targetByDate: string;
  status: string;
  whyGoal?: string | null;
  successLooksLike?: string | null;
  completionFeeling?: string | null;
  motivationIcon?: string | null;
  race_registry?: RaceRegistry | null;
};

const DISTANCE_OPTIONS = [
  { label: "5K", value: "5k" },
  { label: "10K", value: "10k" },
  { label: "10 Mile", value: "10m" },
  { label: "Half", value: "half" },
  { label: "Marathon", value: "marathon" },
  { label: "Ultra", value: "ultra" },
] as const;

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

function normalizeDistanceToValue(stored: string): string {
  const s = stored.trim().toLowerCase();
  for (const opt of DISTANCE_OPTIONS) {
    if (s === opt.value) return opt.value;
  }
  if (s.includes("10") && (s.includes("mile") || s === "10m")) return "10m";
  if (s.includes("half")) return "half";
  if (s.includes("marathon") && !s.includes("half")) return "marathon";
  if (s.includes("ultra")) return "ultra";
  if (s.includes("10k") || s === "10 k") return "10k";
  if (s.includes("5k") || s === "5 k") return "5k";
  return "5k";
}

function distanceDisplayLabel(distanceValue: string): string {
  const opt = DISTANCE_OPTIONS.find((o) => o.value === distanceValue);
  return opt?.label ?? distanceValue;
}

function defaultTargetDatePlus90Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().split("T")[0];
}

function toDateInputValue(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function goalTimeFieldLabel(
  selectedRace: RaceRegistry | null,
  distanceValue: string,
  hasRaceChoice: "yes" | "no" | null
): string {
  if (selectedRace?.raceType?.trim()) {
    return `Goal ${selectedRace.raceType.trim()} time`;
  }
  if (hasRaceChoice === "yes") {
    return "Goal finish time";
  }
  return `Goal ${distanceDisplayLabel(distanceValue)} time`;
}

function daysUntil(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(t);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export default function GoalSetter() {
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [goal, setGoal] = useState<AthleteGoalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showTrainingCta, setShowTrainingCta] = useState(false);

  const [goalName, setGoalName] = useState("");
  const [hasRaceChoice, setHasRaceChoice] = useState<"yes" | "no" | null>(null);

  const [distanceValue, setDistanceValue] =
    useState<(typeof DISTANCE_OPTIONS)[number]["value"]>("5k");
  const [goalTime, setGoalTime] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [raceSearchQuery, setRaceSearchQuery] = useState("");
  const [raceSearchResults, setRaceSearchResults] = useState<RaceRegistry[]>([]);
  const [searchingRaces, setSearchingRaces] = useState(false);
  const [searchCompletedEmpty, setSearchCompletedEmpty] = useState(false);
  const [selectedRace, setSelectedRace] = useState<RaceRegistry | null>(null);

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
          setGoalName(g.name?.trim() ?? "");
          setDistanceValue(normalizeDistanceToValue(g.distance) as (typeof DISTANCE_OPTIONS)[number]["value"]);
          setGoalTime(g.goalTime ?? "");
          setTargetDate(toDateInputValue(g.targetByDate));
          if (g.race_registry) {
            setSelectedRace(g.race_registry);
            setHasRaceChoice("yes");
          } else {
            setSelectedRace(null);
            setHasRaceChoice("no");
          }
          setEditing(false);
        } else {
          setEditing(true);
          setGoalName("");
          setHasRaceChoice(null);
          setTargetDate("");
          setSelectedRace(null);
        }
      })
      .catch(() => {
        setError("Failed to load your goal");
        setEditing(true);
      })
      .finally(() => setLoading(false));
  }, [athleteId]);

  /** goalPace5K is persisted server-side for analysis; we only preview goal race pace here. */
  const liveGoalRacePace = useMemo(() => {
    if (!goalTime.trim()) return null;
    const distanceKey = selectedRace
      ? normalizeDistanceToValue(selectedRace.raceType)
      : distanceValue;
    try {
      const { goalRacePace } = deriveGoalPaces({
        distance: distanceKey,
        goalTime,
        distanceMiles: selectedRace?.distanceMiles ?? null,
      });
      return goalRacePace;
    } catch {
      return null;
    }
  }, [distanceValue, goalTime, selectedRace]);

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
        setHasRaceChoice("yes");
        setGoalName((n) => (n.trim() ? n : mapped.name));
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

  const beginEdit = () => {
    setEditing(true);
    setShowTrainingCta(false);
    setError(null);
    if (goal) {
      setDistanceValue(normalizeDistanceToValue(goal.distance) as (typeof DISTANCE_OPTIONS)[number]["value"]);
      setGoalTime(goal.goalTime ?? "");
      setTargetDate(toDateInputValue(goal.targetByDate));
      setGoalName(goal.name?.trim() ?? "");
      if (goal.race_registry) {
        setSelectedRace(goal.race_registry);
        setHasRaceChoice("yes");
      } else {
        setSelectedRace(null);
        setHasRaceChoice("no");
      }
    }
  };

  const cancelEdit = () => {
    if (goal) {
      setEditing(false);
      setDistanceValue(normalizeDistanceToValue(goal.distance) as (typeof DISTANCE_OPTIONS)[number]["value"]);
      setGoalTime(goal.goalTime ?? "");
      setTargetDate(toDateInputValue(goal.targetByDate));
      setGoalName(goal.name?.trim() ?? "");
      setSelectedRace(goal.race_registry ?? null);
      setHasRaceChoice(goal.race_registry ? "yes" : "no");
      setError(null);
      setRaceSearchQuery("");
      setRaceSearchResults([]);
    }
  };

  const handleSave = async () => {
    if (!athleteId) return;
    setSaving(true);
    setError(null);
    try {
      if (hasRaceChoice === null) {
        setError("Choose whether you have a race to train for.");
        setSaving(false);
        return;
      }
      if (hasRaceChoice === "yes" && !selectedRace) {
        setError("Pick a race so your goal has a finish line and distance.");
        setSaving(false);
        return;
      }

      const distanceForApi = selectedRace
        ? normalizeDistanceToValue(selectedRace.raceType)
        : distanceValue;

      const bodyBase = {
        name: goalName.trim() || null,
        distance: distanceForApi,
        goalTime: goalTime.trim() || null,
        raceRegistryId: selectedRace?.id ?? null,
      };

      if (goal?.id) {
        const targetByDate = selectedRace
          ? new Date(selectedRace.raceDate).toISOString()
          : targetDate.trim()
            ? new Date(targetDate + "T12:00:00.000Z").toISOString()
            : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

        const res = await api.put<{ goal: AthleteGoalRow }>(`/goals/${goal.id}`, {
          ...bodyBase,
          targetByDate,
        });
        setGoal(res.data.goal);
      } else {
        const payload: Record<string, unknown> = {
          ...bodyBase,
        };
        if (!selectedRace) {
          payload.targetByDate = targetDate.trim()
            ? new Date(targetDate + "T12:00:00.000Z").toISOString()
            : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        }

        const res = await api.post<{ goal: AthleteGoalRow }>(`/goals`, payload);
        setGoal(res.data.goal);
        if (res.data.goal.race_registry) {
          setSelectedRace(res.data.goal.race_registry);
          setTargetDate(toDateInputValue(res.data.goal.targetByDate));
        } else {
          setTargetDate(toDateInputValue(res.data.goal.targetByDate));
        }
      }

      setEditing(false);
      setShowTrainingCta(true);
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

  const daysLeft = goal ? daysUntil(goal.targetByDate) : null;

  return (
    <div>
      <Link
        href="/goals"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to goals
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Set your goals. Train. PR.
        </h1>
        <p className="text-gray-600 text-sm sm:text-base max-w-xl">
          Where you want to be on race day — baseline fitness lives in your profile.
        </p>
      </header>

      {showTrainingCta && (
        <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50/80 p-5 shadow-sm">
          <p className="font-semibold text-gray-900 mb-1">Goal set. Now let&apos;s build your training.</p>
          <p className="text-sm text-gray-600 mb-4">
            Add workouts, push to Garmin, and track how you&apos;re trending toward your target.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/training-setup"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
            >
              Training plan setup →
            </Link>
            <Link
              href="/workouts/create"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border-2 border-orange-200 text-orange-800 text-sm font-semibold hover:bg-orange-100/80 transition-colors"
            >
              Create a workout
            </Link>
            <Link
              href="/workouts"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border-2 border-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              View your workouts
            </Link>
          </div>
        </div>
      )}

      {goal && !editing && (
        <div className="mb-8 bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {goal.name?.trim() ? goal.name.trim() : "Your active goal"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {distanceDisplayLabel(normalizeDistanceToValue(goal.distance))}
                {goal.goalTime ? ` · ${goal.goalTime}` : " · completion"}
              </p>
              {goal.race_registry?.name && (
                <p className="text-sm text-gray-700 mt-2">
                  Race: <span className="font-medium">{goal.race_registry.name}</span>
                </p>
              )}
              {daysLeft != null && (
                <p className="text-sm text-gray-600 mt-2">
                  {daysLeft >= 0 ? (
                    <>
                      <span className="font-semibold text-gray-900">{daysLeft}</span> days to target
                    </>
                  ) : (
                    <span className="text-amber-800">Target date has passed — time to set a new goal?</span>
                  )}
                </p>
              )}
              {goal.goalRacePace != null && (
                <p className="text-sm text-gray-600 mt-2">
                  Goal race pace ~{" "}
                  <span className="font-semibold text-gray-900">
                    {formatSecPerMile(goal.goalRacePace)}
                  </span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={beginEdit}
              className="shrink-0 px-4 py-2 rounded-lg border border-orange-200 text-orange-700 font-medium text-sm hover:bg-orange-50 transition-colors"
            >
              Edit goal
            </button>
          </div>
        </div>
      )}

      {(editing || !goal) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What&apos;s your goal?
            </label>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Do you have a race?
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setHasRaceChoice("yes");
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  hasRaceChoice === "yes"
                    ? "bg-orange-50 border-orange-300 text-orange-800"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasRaceChoice("no");
                  setSelectedRace(null);
                  setRaceSearchResults([]);
                  setRaceSearchQuery("");
                  if (!targetDate) setTargetDate(defaultTargetDatePlus90Days());
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  hasRaceChoice === "no"
                    ? "bg-orange-50 border-orange-300 text-orange-800"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Not yet
              </button>
            </div>
          </div>

          {hasRaceChoice === "yes" && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-800">Pick your race</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={raceSearchQuery}
                  onChange={(e) => {
                    setRaceSearchQuery(e.target.value);
                    setSearchCompletedEmpty(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && searchRaces()}
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
                <ul className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
                  {raceSearchResults.map((race) => (
                    <li key={race.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRace(race);
                          setHasRaceChoice("yes");
                          setGoalName((n) => (n.trim() ? n : race.name));
                          setRaceSearchQuery("");
                          setRaceSearchResults([]);
                          setShowCustomRaceForm(false);
                          setTargetDate(toDateInputValue(race.raceDate));
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
                <p className="text-sm text-gray-500">No matches. Try another search or add your race.</p>
              )}

              <button
                type="button"
                onClick={() => setShowCustomRaceForm((v) => !v)}
                className="text-sm font-medium text-orange-600 hover:text-orange-800"
              >
                {showCustomRaceForm ? "Hide add race" : "My race isn't listed — add it"}
              </button>

              {showCustomRaceForm && (
                <div className="p-4 rounded-lg border border-orange-100 bg-orange-50/50 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Race name</label>
                    <input
                      type="text"
                      value={newRaceName}
                      onChange={(e) => setNewRaceName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Race date</label>
                    <input
                      type="date"
                      value={newRaceDate}
                      onChange={(e) => setNewRaceDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Distance</label>
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">City (optional)</label>
                      <input
                        type="text"
                        value={newRaceCity}
                        onChange={(e) => setNewRaceCity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">State (optional)</label>
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
                    {creatingRace ? "Saving…" : "Add race & select"}
                  </button>
                </div>
              )}

              {selectedRace && (
                <p className="text-sm text-gray-700">
                  Selected: <strong>{selectedRace.name}</strong> ({selectedRace.distanceMiles} mi)
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRace(null);
                      if (!targetDate) setTargetDate(defaultTargetDatePlus90Days());
                    }}
                    className="ml-2 text-orange-600 hover:text-orange-800"
                  >
                    Clear
                  </button>
                </p>
              )}
            </div>
          )}

          {hasRaceChoice === "no" && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                What distance are you building toward?
              </label>
              <div className="flex flex-wrap gap-2">
                {DISTANCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDistanceValue(opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      distanceValue === opt.value
                        ? "bg-orange-50 border-orange-300 text-orange-800"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target date <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {goalTimeFieldLabel(selectedRace, distanceValue, hasRaceChoice)}{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={goalTime}
              onChange={(e) => setGoalTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <p className="mt-1 text-xs text-gray-500">H:MM:SS or MM:SS per mile.</p>
            {liveGoalRacePace != null && (
              <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-sm text-gray-800">
                <p>
                  Goal race pace{" "}
                  <span className="font-semibold">{formatSecPerMile(liveGoalRacePace)}</span>
                </p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : goal ? "Save changes" : "Save goal"}
            </button>
            {goal && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
