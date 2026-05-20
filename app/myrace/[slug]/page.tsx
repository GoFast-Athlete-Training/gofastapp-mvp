"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import {
  Calendar,
  MapPin,
  Users,
  Flag,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Zap,
  Trash2,
} from "lucide-react";
import { formatRaceListDate } from "@/lib/races-display";
import { RacePlanSection } from "@/components/races/RacePlanSection";

type ResolvedRace = {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  raceDate: string;
  city: string | null;
  state: string | null;
  distanceLabel: string | null;
  distanceMeters: number | null;
  registrationUrl: string | null;
};

type Signup = {
  id: string;
  raceRegistryId: string;
};

type GoalRow = {
  id: string;
  name?: string | null;
  goalTime?: string | null;
  goalRacePace?: number | null;
  goalPace5K?: number | null;
  raceRegistryId?: string | null;
  race_registry?: { id: string } | null;
};

type ActivePlanSummary = {
  name: string;
  hasSchedule: boolean;
  weekNumber: number | null;
  totalWeeks: number | null;
};

type UpcomingSession = {
  id: string;
  title: string;
  date: string;
  workoutType?: string;
};

type TrainingPlanRow = {
  id: string;
  name: string;
  athleteGoalId: string | null;
};

function formatSecPerMile(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

function formatSessionWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function MyRacePage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";

  const [race, setRace] = useState<ResolvedRace | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [loadingRace, setLoadingRace] = useState(true);
  const [signup, setSignup] = useState<Signup | null>(null);
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [makingGoal, setMakingGoal] = useState(false);
  const [makeGoalError, setMakeGoalError] = useState<string | null>(null);
  const [goalExpanded, setGoalExpanded] = useState(false);
  const [activePlanSummary, setActivePlanSummary] = useState<ActivePlanSummary | null>(null);
  const [nextSession, setNextSession] = useState<UpcomingSession | null>(null);
  const [matchedPlanId, setMatchedPlanId] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removingGoal, setRemovingGoal] = useState(false);
  const [removeGoalError, setRemoveGoalError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug.trim()) {
      setResolveError("missing_slug");
      setLoadingRace(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingRace(true);
      setResolveError(null);
      try {
        const { data } = await api.get<{
          success: boolean;
          race?: ResolvedRace;
          error?: string;
        }>(`/race-hub/public/resolve-by-slug/${encodeURIComponent(slug.trim())}`);
        if (cancelled) return;
        if (!data.success || !data.race) {
          setResolveError(data.error ?? "not_found");
          setRace(null);
        } else {
          setRace(data.race);
        }
      } catch {
        if (!cancelled) {
          setResolveError("not_found");
          setRace(null);
        }
      } finally {
        if (!cancelled) setLoadingRace(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loadSignupAndGoal = useCallback(async (raceRegistryId: string) => {
    setLoadingUser(true);
    try {
      const [suRes, gRes, plansRes, upcomingRes] = await Promise.all([
        api.get<{ signups: Signup[] }>("/race-signups"),
        api.get<{ goals: GoalRow[] }>("/goals?status=ACTIVE").catch(() => ({ data: { goals: [] as const } })),
        api.get<{ plans?: TrainingPlanRow[] }>("/training-plan?status=active").catch(() => ({ data: { plans: [] } })),
        api.get<{ sessions?: UpcomingSession[]; activePlanSummary?: ActivePlanSummary | null }>(
          "/training/upcoming?limit=1"
        ).catch(() => ({ data: { sessions: [], activePlanSummary: null } })),
      ]);
      const su = (suRes.data.signups ?? []).find((s) => s.raceRegistryId === raceRegistryId) ?? null;
      setSignup(su);
      const goals = gRes.data.goals ?? [];
      const g =
        goals.find(
          (x) =>
            x.raceRegistryId === raceRegistryId ||
            x.race_registry?.id === raceRegistryId
        ) ?? null;
      setGoal(g);

      const plans = plansRes.data.plans ?? [];
      const planForGoal = g?.id
        ? plans.find((p) => p.athleteGoalId === g.id) ?? null
        : null;
      setMatchedPlanId(planForGoal?.id ?? null);

      const summary = upcomingRes.data.activePlanSummary ?? null;
      const sessions = upcomingRes.data.sessions ?? [];
      if (planForGoal && summary) {
        setActivePlanSummary(summary);
        setNextSession(sessions[0] ?? null);
      } else {
        setActivePlanSummary(null);
        setNextSession(null);
      }
    } catch {
      setSignup(null);
      setGoal(null);
      setActivePlanSummary(null);
      setNextSession(null);
      setMatchedPlanId(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    const rid = race?.id;
    if (!rid) return;

    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace(`/signup?redirect=${encodeURIComponent(`/myrace/${slug}`)}`);
        return;
      }
      void loadSignupAndGoal(rid);
    });
    return () => unsub();
  }, [race?.id, slug, router, loadSignupAndGoal]);

  async function handleMakeGoalRace() {
    if (!race) return;
    setMakingGoal(true);
    setMakeGoalError(null);
    try {
      const res = await api.post<{ goal: GoalRow }>("/goals", {
        raceRegistryId: race.id,
        name: race.name,
        distance: race.distanceLabel ?? undefined,
        targetByDate: race.raceDate,
      });
      setGoal(res.data.goal);
      setGoalExpanded(true);
      if (race.id) void loadSignupAndGoal(race.id);
    } catch (err: unknown) {
      setMakeGoalError(err instanceof Error ? err.message : "Failed — try again");
    } finally {
      setMakingGoal(false);
    }
  }

  async function handleRemoveGoal() {
    if (!goal?.id) return;
    setRemovingGoal(true);
    setRemoveGoalError(null);
    try {
      await api.delete(`/goals/${encodeURIComponent(goal.id)}`);
      router.push("/races");
    } catch (err: unknown) {
      setRemoveGoalError(err instanceof Error ? err.message : "Could not remove goal");
      setRemovingGoal(false);
    }
  }

  if (loadingRace) {
    return <p className="text-gray-500 text-sm">Loading race…</p>;
  }

  if (resolveError || !race) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-gray-800 font-medium">Race not found</p>
        <Link href="/races" className="mt-4 inline-block text-orange-600 font-semibold hover:underline">
          ← My Races
        </Link>
      </div>
    );
  }

  const locationText = [race.city, race.state].filter(Boolean).join(", ") || null;
  const isGoalRace = Boolean(
    goal &&
      (goal.raceRegistryId === race.id || goal.race_registry?.id === race.id)
  );
  const hasSignup = Boolean(signup);
  const goalTimeDisplay = goal?.goalTime?.trim() || null;
  const goalPaceDisplay = formatSecPerMile(goal?.goalRacePace);

  return (
    <div className="space-y-6">
      <Link
        href="/races"
        className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline"
      >
        <ChevronLeft className="w-4 h-4" />
        My Races
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {race.logoUrl ? (
          <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0">
            <img src={race.logoUrl} alt="" className="w-full h-full object-contain" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{race.name}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4 shrink-0" />
              {formatRaceListDate(race.raceDate)}
            </span>
            {locationText ? (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4 shrink-0" />
                {locationText}
              </span>
            ) : null}
          </div>
          {race.distanceLabel?.trim() ? (
            <p className="text-sm text-gray-700 mt-2">{race.distanceLabel}</p>
          ) : null}
        </div>
      </div>

      {loadingUser ? (
        <p className="text-gray-500 text-sm">Loading your race…</p>
      ) : !hasSignup ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-medium">This race isn&apos;t on your calendar yet.</p>
          <Link
            href="/races/find"
            className="mt-2 inline-block font-semibold text-orange-700 hover:underline"
          >
            Find the race and add it
          </Link>
        </div>
      ) : (
        <>
          {!isGoalRace ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-700 mb-3">
                This race is on your calendar. Make it your goal race to set a target time and build a
                training plan around it.
              </p>
              <button
                type="button"
                onClick={handleMakeGoalRace}
                disabled={makingGoal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                <Flag className="w-4 h-4" />
                {makingGoal ? "Setting…" : "Make this my goal race"}
              </button>
              {makeGoalError ? (
                <p className="mt-2 text-xs text-red-600">{makeGoalError}</p>
              ) : null}
            </section>
          ) : (
            <>
              {/* Widget 1 — My Goal */}
              <section className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGoalExpanded((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-orange-50/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-orange-800">My goal</p>
                    {goalTimeDisplay ? (
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-xl font-bold text-gray-900 tabular-nums">{goalTimeDisplay}</span>
                        {goalPaceDisplay !== "—" ? (
                          <span className="text-sm text-gray-600">avg {goalPaceDisplay}</span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-700">Set your finish goal time</p>
                    )}
                  </div>
                  {goalExpanded ? (
                    <ChevronUp className="w-5 h-5 text-orange-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-orange-600 shrink-0" />
                  )}
                </button>
                {goalExpanded ? (
                  <div className="px-5 pb-5 border-t border-orange-100">
                    <RacePlanSection race={race} goal={goal} onGoalSaved={setGoal} />
                  </div>
                ) : null}
              </section>

              {/* Widget 2 — My Training Plan */}
              <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  My training plan
                </h2>
                {activePlanSummary?.hasSchedule &&
                activePlanSummary.weekNumber != null &&
                activePlanSummary.totalWeeks != null ? (
                  <>
                    <p className="mt-2 text-base font-semibold text-gray-900">
                      {activePlanSummary.name}
                    </p>
                    <span className="mt-2 inline-flex items-center rounded-full bg-emerald-100 text-emerald-900 px-3 py-1 text-xs font-bold">
                      Week {activePlanSummary.weekNumber} of {activePlanSummary.totalWeeks}
                    </span>
                    {nextSession ? (
                      <div className="mt-3 rounded-lg border border-emerald-100 bg-white/80 px-4 py-3">
                        <p className="text-xs font-semibold uppercase text-gray-500">Next session</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{nextSession.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{formatSessionWhen(nextSession.date)}</p>
                      </div>
                    ) : null}
                    <Link
                      href="/training"
                      className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      View full plan →
                    </Link>
                  </>
                ) : goalTimeDisplay ? (
                  <>
                    <p className="mt-2 text-sm text-gray-700">
                      You have a goal time — build a plan to get race-ready.
                    </p>
                    <Link
                      href={`/training-setup?goalId=${encodeURIComponent(goal!.id)}`}
                      className="mt-4 inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                      Build a training plan
                    </Link>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-gray-600">
                    Set a goal time above, then start a training plan.
                  </p>
                )}
              </section>

              {/* Widget 3 — Remove as goal race */}
              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                {!removeConfirmOpen ? (
                  <button
                    type="button"
                    onClick={() => setRemoveConfirmOpen(true)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove as goal race
                  </button>
                ) : (
                  <div>
                    <p className="text-sm text-gray-800">
                      Are you sure? This will archive your goal for this race.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRemoveGoal()}
                        disabled={removingGoal}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {removingGoal ? "Removing…" : "Yes, remove goal"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveConfirmOpen(false);
                          setRemoveGoalError(null);
                        }}
                        disabled={removingGoal}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                    {removeGoalError ? (
                      <p className="mt-2 text-xs text-red-600">{removeGoalError}</p>
                    ) : null}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Widget 4 — Others racing this race */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              Others racing this race
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              See who else is running, join the chatter, and find shakeout runs.
            </p>
            <Link
              href={`/race-hub/${race.id}`}
              className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Join others racing this →
            </Link>
            {race.registrationUrl ? (
              <a
                href={race.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 text-sm font-medium text-orange-600 hover:underline"
              >
                Official registration
              </a>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
