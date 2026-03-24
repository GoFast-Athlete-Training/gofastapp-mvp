"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
import { Calendar, MapPin, Search, ExternalLink, X } from "lucide-react";

type CatalogRace = {
  id: string;
  name: string;
  raceType: string;
  distanceMiles: number;
  raceDate: string;
  city: string | null;
  state: string | null;
  country?: string | null;
  registrationUrl: string | null;
};

type Signup = {
  id: string;
  athleteId: string;
  raceRegistryId: string;
  selfDeclaredAt: string;
  goalId: string | null;
  race_registry: CatalogRace;
};

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

/** Whole calendar days until race (local midnight comparison). */
function daysUntilRace(iso: string): number {
  const race = new Date(iso);
  const today = new Date();
  const startRace = new Date(race.getFullYear(), race.getMonth(), race.getDate());
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((startRace.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
}

function countdownLabel(iso: string): string {
  const d = daysUntilRace(iso);
  if (d < 0) return "Past race";
  if (d === 0) return "Race day!";
  if (d === 1) return "1 day away";
  return `${d} days away`;
}

export default function RacesPage() {
  const router = useRouter();
  const [signups, setSignups] = useState<Signup[]>([]);
  const [catalog, setCatalog] = useState<CatalogRace[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingSignups, setLoadingSignups] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [submittingRaceId, setSubmittingRaceId] = useState<string | null>(null);
  const [removingSignupId, setRemovingSignupId] = useState<string | null>(null);
  const [goalPromptSignupId, setGoalPromptSignupId] = useState<string | null>(null);
  const [goalPromptTime, setGoalPromptTime] = useState("");
  const [savingGoalSignupId, setSavingGoalSignupId] = useState<string | null>(null);

  const signedRaceIds = useMemo(
    () => new Set(signups.map((s) => s.raceRegistryId)),
    [signups]
  );

  const loadSignups = useCallback(async () => {
    setLoadingSignups(true);
    try {
      const { data } = await api.get<{ signups: Signup[] }>("/race-signups");
      setSignups(data.signups ?? []);
    } catch (e) {
      console.error(e);
      setSignups([]);
    } finally {
      setLoadingSignups(false);
    }
  }, []);

  const loadCatalog = useCallback(async (q: string) => {
    setLoadingCatalog(true);
    try {
      const params = q.trim()
        ? `q=${encodeURIComponent(q.trim())}`
        : "upcoming=true";
      const { data } = await api.get<{ success?: boolean; race_registry?: CatalogRace[] }>(
        `/race/search?${params}`
      );
      setCatalog(data.race_registry ?? []);
    } catch (e) {
      console.error(e);
      setCatalog([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    loadSignups();
  }, [loadSignups]);

  useEffect(() => {
    loadCatalog(debouncedSearch);
  }, [debouncedSearch, loadCatalog]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) router.replace("/signup");
    });
    return () => unsub();
  }, [router]);

  async function onImIn(raceId: string) {
    setSubmittingRaceId(raceId);
    try {
      const { data } = await api.post<{ signup: Signup }>("/race-signups", {
        raceRegistryId: raceId,
      });
      if (data.signup) {
        setGoalPromptSignupId(data.signup.id);
        setGoalPromptTime("");
        setSignups((prev) => {
          const rest = prev.filter((s) => s.raceRegistryId !== raceId);
          return [...rest, data.signup].sort(
            (a, b) =>
              new Date(a.race_registry.raceDate).getTime() -
              new Date(b.race_registry.raceDate).getTime()
          );
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingRaceId(null);
    }
  }

  async function saveGoalForSignup(signup: Signup) {
    if (!goalPromptTime.trim()) {
      return;
    }
    setSavingGoalSignupId(signup.id);
    try {
      const { data: goalRes } = await api.post<{ goal: { id: string } }>("/goals", {
        name: signup.race_registry.name,
        distance: "",
        goalTime: goalPromptTime.trim(),
        raceRegistryId: signup.raceRegistryId,
      });
      const goalId = goalRes.goal?.id;
      if (!goalId) return;
      const { data: patchRes } = await api.patch<{ signup: Signup }>(
        `/race-signups/${signup.id}`,
        { goalId }
      );
      if (patchRes.signup) {
        setSignups((prev) =>
          prev.map((s) => (s.id === signup.id ? patchRes.signup : s))
        );
      }
      setGoalPromptSignupId(null);
      setGoalPromptTime("");
    } catch (e) {
      console.error(e);
    } finally {
      setSavingGoalSignupId(null);
    }
  }

  async function onImOut(signupId: string) {
    setRemovingSignupId(signupId);
    try {
      await api.delete(`/race-signups/${signupId}`);
      if (goalPromptSignupId === signupId) {
        setGoalPromptSignupId(null);
        setGoalPromptTime("");
      }
      setSignups((prev) => prev.filter((s) => s.id !== signupId));
    } catch (e) {
      console.error(e);
    } finally {
      setRemovingSignupId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Races</h1>
                <p className="text-gray-600 text-sm mt-1">
                  Browse upcoming races, tap <span className="font-medium">I&apos;m in</span> to
                  track them on your calendar. Register on the official site — we can&apos;t confirm
                  signup, but we&apos;ll help you count down.
                </p>
              </div>
              <Link
                href="/goals"
                className="text-sm text-orange-600 font-medium hover:underline shrink-0"
              >
                Pace / goal settings
              </Link>
            </div>

            {/* My races rail */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                My races
              </h2>
              {loadingSignups ? (
                <p className="text-gray-500 text-sm">Loading your races…</p>
              ) : signups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-6 text-center text-sm text-gray-600">
                  No races added yet. Browse below and tap <strong>I&apos;m in</strong> on any
                  event you&apos;re planning to run.
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {signups.map((s) => {
                    const r = s.race_registry;
                    return (
                      <div
                        key={s.id}
                        className="min-w-[240px] max-w-[280px] shrink-0 rounded-xl border border-orange-100 bg-white shadow-sm p-4 relative"
                      >
                        <button
                          type="button"
                          onClick={() => onImOut(s.id)}
                          disabled={removingSignupId === s.id}
                          className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          aria-label="Remove from my races"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <p className="font-semibold text-gray-900 pr-7 leading-snug">{r.name}</p>
                        <p className="text-xs font-medium text-orange-600 mt-2">
                          {countdownLabel(r.raceDate)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(r.raceDate)}
                        </p>
                        {(r.city || r.state) && (
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {[r.city, r.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-2">
                          {r.distanceMiles} mi · {r.raceType}
                        </p>
                        {!s.goalId && goalPromptSignupId !== s.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setGoalPromptSignupId(s.id);
                              setGoalPromptTime("");
                            }}
                            className="mt-3 text-xs font-medium text-orange-600 hover:text-orange-800"
                          >
                            Set goal time
                          </button>
                        )}
                        {goalPromptSignupId === s.id && !s.goalId && (
                          <div className="mt-3 pt-3 border-t border-orange-100 space-y-2">
                            <p className="text-xs font-medium text-gray-800">
                              Goal time for {r.name}?
                            </p>
                            <input
                              type="text"
                              value={goalPromptTime}
                              onChange={(e) => setGoalPromptTime(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-orange-500"
                            />
                            <p className="text-[10px] text-gray-500">
                              H:MM:SS or MM:SS — powers workout paces.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!goalPromptTime.trim() || savingGoalSignupId === s.id}
                                onClick={() => saveGoalForSignup(s)}
                                className="px-3 py-1.5 rounded-md bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-50"
                              >
                                {savingGoalSignupId === s.id ? "Saving…" : "Save goal"}
                              </button>
                              <button
                                type="button"
                                disabled={savingGoalSignupId === s.id}
                                onClick={() => {
                                  setGoalPromptSignupId(null);
                                  setGoalPromptTime("");
                                }}
                                className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50"
                              >
                                Skip for now
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Search + catalog */}
            <section>
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search races by name…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {debouncedSearch.trim()
                    ? "Search results (active races)"
                    : "Upcoming races in the registry"}
                </p>
              </div>

              {loadingCatalog ? (
                <p className="text-gray-500 text-sm">Loading races…</p>
              ) : catalog.length === 0 ? (
                <p className="text-gray-600 text-sm">
                  No races found. Try another search, or ask your organizer to publish events to
                  GoFast.
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {catalog.map((race) => {
                    const signedUp = signedRaceIds.has(race.id);
                    const busy = submittingRaceId === race.id;
                    return (
                      <li
                        key={race.id}
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col"
                      >
                        <h3 className="font-semibold text-gray-900 text-lg leading-snug">
                          {race.name}
                        </h3>
                        <dl className="mt-3 space-y-1.5 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                            <span>{formatDate(race.raceDate)}</span>
                            <span className="text-gray-400">·</span>
                            <span className="text-orange-600 font-medium text-xs">
                              {countdownLabel(race.raceDate)}
                            </span>
                          </div>
                          {(race.city || race.state) && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                              <span>{[race.city, race.state].filter(Boolean).join(", ")}</span>
                            </div>
                          )}
                          <div>
                            {race.distanceMiles} mi · {race.raceType}
                          </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {signedUp ? (
                            <span className="inline-flex items-center rounded-full bg-green-50 text-green-800 text-xs font-medium px-3 py-1">
                              On my list
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onImIn(race.id)}
                              className="inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2"
                            >
                              {busy ? "Saving…" : "I'm in"}
                            </button>
                          )}
                          {race.registrationUrl ? (
                            <a
                              href={race.registrationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-orange-600 font-medium hover:underline"
                            >
                              Register
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
