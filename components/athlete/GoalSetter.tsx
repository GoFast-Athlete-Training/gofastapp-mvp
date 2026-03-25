"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  description?: string | null;
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

function isLongRaceDistanceKey(key: string): boolean {
  return key === "marathon" || key === "half";
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

function formatRaceDateDisplay(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function parseGoalTimeToParts(goalTime: string | null | undefined): {
  h: string;
  m: string;
  s: string;
} {
  const t = goalTime?.trim() ?? "";
  if (!t) return { h: "", m: "", s: "" };
  const parts = t.split(":");
  if (parts.length === 3) return { h: parts[0], m: parts[1], s: parts[2] };
  if (parts.length === 2) return { h: "", m: parts[0], s: parts[1] };
  return { h: "", m: "", s: "" };
}

function assembleGoalTimePreview(
  selectedRace: RaceRegistry,
  h: string,
  m: string,
  s: string
): string {
  const k = normalizeDistanceToValue(selectedRace.raceType);
  const isLong = isLongRaceDistanceKey(k);
  if (isLong) {
    const hh = h.padStart(2, "0") || "0";
    const mm = m.padStart(2, "0") || "0";
    const ss = s.padStart(2, "0") || "0";
    return `${hh}:${mm}:${ss}`;
  }
  if (!h || h === "0") {
    const mm = m.padStart(2, "0") || "0";
    const ss = s.padStart(2, "0") || "0";
    return `${mm}:${ss}`;
  }
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
}

function validateAndAssembleGoalTime(
  selectedRace: RaceRegistry,
  h: string,
  m: string,
  s: string
):
  | { ok: true; goalTime: string | null }
  | { ok: false; message: string } {
  const allEmpty = !h.trim() && !m.trim() && !s.trim();
  if (allEmpty) return { ok: true, goalTime: null };

  const k = normalizeDistanceToValue(selectedRace.raceType);
  const isLong = isLongRaceDistanceKey(k);

  if (isLong) {
    if (!h.trim() || !m.trim() || !s.trim()) {
      return {
        ok: false,
        message:
          "Enter hours, minutes, and seconds for your goal time, or clear all fields.",
      };
    }
    const hh = parseInt(h, 10);
    const mm = parseInt(m, 10);
    const ss = parseInt(s, 10);
    if (
      [hh, mm, ss].some((n) => Number.isNaN(n)) ||
      mm >= 60 ||
      ss >= 60 ||
      hh < 0
    ) {
      return {
        ok: false,
        message: "Invalid time. Minutes and seconds must be under 60.",
      };
    }
    return {
      ok: true,
      goalTime: `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`,
    };
  }

  if (!m.trim() || !s.trim()) {
    return {
      ok: false,
      message: "Enter minutes and seconds, or clear all fields.",
    };
  }
  const mm = parseInt(m, 10);
  const ss = parseInt(s, 10);
  if (Number.isNaN(mm) || Number.isNaN(ss) || mm >= 60 || ss >= 60) {
    return {
      ok: false,
      message: "Invalid time. Minutes and seconds must be under 60.",
    };
  }
  if (h.trim() && h !== "0") {
    const hh = parseInt(h, 10);
    if (Number.isNaN(hh) || hh < 0) {
      return { ok: false, message: "Invalid hours." };
    }
    return {
      ok: true,
      goalTime: `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`,
    };
  }
  return {
    ok: true,
    goalTime: `${m.padStart(2, "0")}:${s.padStart(2, "0")}`,
  };
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
  const [showRaceSearch, setShowRaceSearch] = useState(true);

  const [goalHours, setGoalHours] = useState("");
  const [goalMinutes, setGoalMinutes] = useState("");
  const [goalSeconds, setGoalSeconds] = useState("");

  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const secondsRef = useRef<HTMLInputElement>(null);
  const shortHoursRef = useRef<HTMLInputElement>(null);
  const shortMinutesRef = useRef<HTMLInputElement>(null);
  const shortSecondsRef = useRef<HTMLInputElement>(null);

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

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setGoalName(g.name?.trim() || g.race_registry?.name || "");
          const parts = parseGoalTimeToParts(g.goalTime);
          setGoalHours(parts.h);
          setGoalMinutes(parts.m);
          setGoalSeconds(parts.s);
          if (g.race_registry) {
            setSelectedRace(g.race_registry);
            setShowRaceSearch(false);
          } else {
            setSelectedRace(null);
            setShowRaceSearch(true);
          }
          setEditing(false);
        } else {
          setEditing(true);
          setGoalName("");
          setSelectedRace(null);
          setShowRaceSearch(true);
          setGoalHours("");
          setGoalMinutes("");
          setGoalSeconds("");
        }
      })
      .catch(() => {
        setError("Failed to load your goal");
        setEditing(true);
      })
      .finally(() => setLoading(false));
  }, [athleteId]);

  const runRaceSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) {
      setRaceSearchResults([]);
      setSearchCompletedEmpty(false);
      return;
    }
    setSearchingRaces(true);
    setSearchCompletedEmpty(false);
    try {
      const res = await api.post<{
        success: boolean;
        race_registry?: RaceRegistry[];
      }>("/race/search", { query: q });
      const list = res.data?.race_registry ?? [];
      setRaceSearchResults(list);
      setSearchCompletedEmpty(list.length === 0);
    } catch {
      setRaceSearchResults([]);
      setSearchCompletedEmpty(true);
    } finally {
      setSearchingRaces(false);
    }
  }, []);

  useEffect(() => {
    const q = raceSearchQuery.trim();
    if (!q) {
      setRaceSearchResults([]);
      setSearchCompletedEmpty(false);
      setSearchingRaces(false);
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      runRaceSearch(q);
      searchDebounceRef.current = null;
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [raceSearchQuery, runRaceSearch]);

  const timePreview = useMemo(() => {
    if (!selectedRace) return "";
    return assembleGoalTimePreview(
      selectedRace,
      goalHours,
      goalMinutes,
      goalSeconds
    );
  }, [selectedRace, goalHours, goalMinutes, goalSeconds]);

  const liveGoalRacePace = useMemo(() => {
    if (!selectedRace) return null;
    const v = validateAndAssembleGoalTime(
      selectedRace,
      goalHours,
      goalMinutes,
      goalSeconds
    );
    if (!v.ok || !v.goalTime) return null;
    const distanceKey = normalizeDistanceToValue(selectedRace.raceType);
    try {
      const { goalRacePace } = deriveGoalPaces({
        distance: distanceKey,
        goalTime: v.goalTime,
        distanceMiles: selectedRace.distanceMiles ?? null,
      });
      return goalRacePace;
    } catch {
      return null;
    }
  }, [selectedRace, goalHours, goalMinutes, goalSeconds]);

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
        setGoalName((n) => (n.trim() ? n : mapped.name));
        setRaceSearchQuery("");
        setRaceSearchResults([]);
        setShowRaceSearch(false);
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
      const parts = parseGoalTimeToParts(goal.goalTime);
      setGoalHours(parts.h);
      setGoalMinutes(parts.m);
      setGoalSeconds(parts.s);
      setGoalName(goal.name?.trim() || goal.race_registry?.name || "");
      if (goal.race_registry) {
        setSelectedRace(goal.race_registry);
        setShowRaceSearch(false);
      } else {
        setSelectedRace(null);
        setShowRaceSearch(true);
      }
    }
  };

  const cancelEdit = () => {
    if (goal) {
      setEditing(false);
      const parts = parseGoalTimeToParts(goal.goalTime);
      setGoalHours(parts.h);
      setGoalMinutes(parts.m);
      setGoalSeconds(parts.s);
      setGoalName(goal.name?.trim() || goal.race_registry?.name || "");
      setSelectedRace(goal.race_registry ?? null);
      setShowRaceSearch(!goal.race_registry);
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
      if (!selectedRace) {
        setError("Pick a race to train for — your goal is your race.");
        setSaving(false);
        return;
      }

      const timeResult = validateAndAssembleGoalTime(
        selectedRace,
        goalHours,
        goalMinutes,
        goalSeconds
      );
      if (!timeResult.ok) {
        setError(timeResult.message);
        setSaving(false);
        return;
      }

      const distanceForApi = normalizeDistanceToValue(selectedRace.raceType);
      const nameForApi =
        goalName.trim() || selectedRace.name;
      const bodyBase = {
        name: nameForApi,
        distance: distanceForApi,
        goalTime: timeResult.goalTime,
        raceRegistryId: selectedRace.id,
      };

      const targetByDate = new Date(selectedRace.raceDate).toISOString();

      if (goal?.id) {
        const res = await api.put<{ goal: AthleteGoalRow }>(`/goals/${goal.id}`, {
          ...bodyBase,
          targetByDate,
        });
        setGoal(res.data.goal);
      } else {
        const res = await api.post<{ goal: AthleteGoalRow }>(`/goals`, {
          ...bodyBase,
          targetByDate,
        });
        setGoal(res.data.goal);
        if (res.data.goal.race_registry) {
          setSelectedRace(res.data.goal.race_registry);
        }
      }

      setShowRaceSearch(false);
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

  const isLongRaceUi =
    selectedRace != null &&
    isLongRaceDistanceKey(normalizeDistanceToValue(selectedRace.raceType));

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
        href="/athlete-home"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to home
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Your race goal
        </h1>
        <p className="text-gray-600 text-sm sm:text-base max-w-xl">
          Pick your race, then when you want to finish. Goal pace is inferred from that time.
        </p>
      </header>

      {showTrainingCta && (
        <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50/80 p-5 shadow-sm">
          <p className="font-semibold text-gray-900 mb-1">
            Race goal saved. Now let&apos;s build your training.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Add workouts, push to Garmin, and track how you&apos;re trending toward your target.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/training"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
            >
              Open Training →
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
                {goal.race_registry?.name ||
                  goal.name?.trim() ||
                  "Your active race goal"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {distanceDisplayLabel(normalizeDistanceToValue(goal.distance))}
                {goal.goalTime ? ` · ${goal.goalTime}` : ""}
              </p>
              {goal.race_registry && (
                <p className="text-sm text-gray-600 mt-2">
                  Race day: {formatRaceDateDisplay(goal.race_registry.raceDate)}
                </p>
              )}
              {!goal.race_registry && (
                <p className="text-sm text-amber-800 mt-2">
                  No race linked — edit to pick a race.
                </p>
              )}
              {daysLeft != null && (
                <p className="text-sm text-gray-600 mt-2">
                  {daysLeft >= 0 ? (
                    <>
                      <span className="font-semibold text-gray-900">{daysLeft}</span>{" "}
                      days to race
                    </>
                  ) : (
                    <span className="text-amber-800">
                      Race date has passed — time to set a new goal?
                    </span>
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
              Edit
            </button>
          </div>
        </div>
      )}

      {(editing || !goal) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Your race</h2>
            <p className="text-xs text-gray-500 mb-3">
              Search as you type, or add a race that isn&apos;t listed.
            </p>

            {selectedRace && !showRaceSearch && (
              <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-4 mb-4">
                <p className="text-sm font-medium text-gray-900">{selectedRace.name}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedRace.distanceMiles} mi · {formatRaceDateDisplay(selectedRace.raceDate)}
                  {(selectedRace.city || selectedRace.state) && (
                    <>
                      {" "}
                      · {[selectedRace.city, selectedRace.state].filter(Boolean).join(", ")}
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowRaceSearch(true);
                    setRaceSearchQuery("");
                    setRaceSearchResults([]);
                  }}
                  className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-900 underline-offset-2 hover:underline"
                >
                  Change race
                </button>
              </div>
            )}

            {(showRaceSearch || !selectedRace) && (
              <div className="space-y-4">
                {selectedRace && showRaceSearch && (
                  <button
                    type="button"
                    onClick={() => setShowRaceSearch(false)}
                    className="text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
                  >
                    Keep current race
                  </button>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={raceSearchQuery}
                    onChange={(e) => {
                      setRaceSearchQuery(e.target.value);
                      setSearchCompletedEmpty(false);
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    autoComplete="off"
                  />
                  {searchingRaces && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {raceSearchQuery.trim() && raceSearchResults.length > 0 && (
                  <ul className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
                    {raceSearchResults.map((race) => (
                      <li key={race.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRace(race);
                            setGoalName((n) => (n.trim() ? n : race.name));
                            setRaceSearchQuery("");
                            setRaceSearchResults([]);
                            setShowCustomRaceForm(false);
                            setShowRaceSearch(false);
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
                {raceSearchQuery.trim().length >= 2 &&
                  searchCompletedEmpty &&
                  !searchingRaces && (
                    <p className="text-sm text-gray-500">
                      No matches. Try another search or add your race below.
                    </p>
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
                      {creatingRace ? "Saving…" : "Add race & select"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedRace && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">
                When do you want to finish {selectedRace.name}?
              </h2>
              <p className="text-xs text-gray-500">
                Goal time is optional. Format matches training setup (e.g.{" "}
                <span className="font-mono">3:05:30</span> for a marathon).
              </p>

              {isLongRaceUi ? (
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="w-20 sm:w-24">
                    <label className="block text-xs text-gray-500 mb-1">Hours</label>
                    <input
                      ref={hoursRef}
                      type="number"
                      min={0}
                      max={23}
                      value={goalHours}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (
                          val === "" ||
                          (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 23)
                        ) {
                          setGoalHours(val);
                          if (val.length === 2 && minutesRef.current) {
                            minutesRef.current.focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (
                          (e.key === "Tab" || e.key === "Enter") &&
                          !e.shiftKey &&
                          minutesRef.current
                        ) {
                          e.preventDefault();
                          minutesRef.current.focus();
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <span className="text-xl text-gray-400 pb-2">:</span>
                  <div className="w-20 sm:w-24">
                    <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                    <input
                      ref={minutesRef}
                      type="number"
                      min={0}
                      max={59}
                      value={goalMinutes}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (
                          val === "" ||
                          (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)
                        ) {
                          setGoalMinutes(val);
                          if (val.length === 2 && secondsRef.current) {
                            secondsRef.current.focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (
                          (e.key === "Tab" || e.key === "Enter") &&
                          !e.shiftKey &&
                          secondsRef.current
                        ) {
                          e.preventDefault();
                          secondsRef.current.focus();
                        } else if (e.key === "Tab" && e.shiftKey && hoursRef.current) {
                          e.preventDefault();
                          hoursRef.current.focus();
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <span className="text-xl text-gray-400 pb-2">:</span>
                  <div className="w-20 sm:w-24">
                    <label className="block text-xs text-gray-500 mb-1">Seconds</label>
                    <input
                      ref={secondsRef}
                      type="number"
                      min={0}
                      max={59}
                      value={goalSeconds}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (
                          val === "" ||
                          (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)
                        ) {
                          setGoalSeconds(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Tab" && e.shiftKey && minutesRef.current) {
                          e.preventDefault();
                          minutesRef.current.focus();
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="w-20 sm:w-24">
                      <label className="block text-xs text-gray-500 mb-1">
                        Hours (optional)
                      </label>
                      <input
                        ref={shortHoursRef}
                        type="number"
                        min={0}
                        max={23}
                        value={goalHours}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          if (
                            val === "" ||
                            (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 23)
                          ) {
                            setGoalHours(val);
                            if (val.length === 2 && shortMinutesRef.current) {
                              shortMinutesRef.current.focus();
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Tab" || e.key === "Enter") &&
                            !e.shiftKey &&
                            shortMinutesRef.current
                          ) {
                            e.preventDefault();
                            shortMinutesRef.current.focus();
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <span className="text-xl text-gray-400 pb-2">:</span>
                    <div className="w-20 sm:w-24">
                      <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                      <input
                        ref={shortMinutesRef}
                        type="number"
                        min={0}
                        max={59}
                        value={goalMinutes}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          if (
                            val === "" ||
                            (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)
                          ) {
                            setGoalMinutes(val);
                            if (val.length === 2 && shortSecondsRef.current) {
                              shortSecondsRef.current.focus();
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Tab" || e.key === "Enter") &&
                            !e.shiftKey &&
                            shortSecondsRef.current
                          ) {
                            e.preventDefault();
                            shortSecondsRef.current.focus();
                          } else if (
                            e.key === "Tab" &&
                            e.shiftKey &&
                            shortHoursRef.current
                          ) {
                            e.preventDefault();
                            shortHoursRef.current.focus();
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <span className="text-xl text-gray-400 pb-2">:</span>
                    <div className="w-20 sm:w-24">
                      <label className="block text-xs text-gray-500 mb-1">Seconds</label>
                      <input
                        ref={shortSecondsRef}
                        type="number"
                        min={0}
                        max={59}
                        value={goalSeconds}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          if (
                            val === "" ||
                            (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)
                          ) {
                            setGoalSeconds(val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Tab" && e.shiftKey && shortMinutesRef.current) {
                            e.preventDefault();
                            shortMinutesRef.current.focus();
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSave();
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(goalHours || goalMinutes || goalSeconds) && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm">
                  <p className="font-medium text-gray-900">
                    Goal time: <span className="font-mono">{timePreview}</span>
                  </p>
                  {liveGoalRacePace != null && (
                    <p className="text-gray-800 mt-1">
                      Inferred pace:{" "}
                      <span className="font-semibold">
                        {formatSecPerMile(liveGoalRacePace)}
                      </span>{" "}
                      avg
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : goal ? "Save changes" : "Save race goal"}
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
