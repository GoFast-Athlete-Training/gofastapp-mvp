"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import {
  Calendar,
  MapPin,
  Flag,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Zap,
  Trash2,
  MessageCircle,
  ExternalLink,
  Route,
} from "lucide-react";
import { formatRaceListDate, daysUntilRace } from "@/lib/races-display";
import { RacePlanSection } from "@/components/races/RacePlanSection";
import {
  getPublicCoursePageUrl,
  getPublicRacePageUrl,
} from "@/lib/public-race-url";
import { resolveGoalRacePace } from "@/lib/training/goal-pace-calculator";

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

type RaceExtras = {
  courseSlug: string | null;
  courseMapUrl: string | null;
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

type ChatterPreviewMessage = {
  id: string;
  content: string;
  createdAt: string;
  athlete: {
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
  };
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

function countdownChipLabel(iso: string): string {
  const d = daysUntilRace(iso);
  if (d < 0) return "Past race";
  if (d === 0) return "Race day!";
  if (d === 1) return "1 day to go";
  if (d <= 14) return `${d} days to go`;
  const w = Math.ceil(d / 7);
  return `${w} week${w === 1 ? "" : "s"} to go`;
}

function displayName(a: ChatterPreviewMessage["athlete"]): string {
  const handle = a.gofastHandle?.trim();
  if (handle) return `@${handle}`;
  const name = [a.firstName, a.lastName].filter(Boolean).join(" ").trim();
  return name || "Runner";
}

function normalizePreviewMessage(raw: Record<string, unknown>): ChatterPreviewMessage | null {
  const a = (raw.Athlete ?? raw.athlete) as ChatterPreviewMessage["athlete"] | undefined;
  if (!raw.id || typeof raw.content !== "string" || !a) return null;
  return {
    id: String(raw.id),
    content: raw.content,
    createdAt: String(raw.createdAt),
    athlete: {
      firstName: a.firstName ?? null,
      lastName: a.lastName ?? null,
      gofastHandle: a.gofastHandle ?? null,
    },
  };
}

export default function MyRacePage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";

  const [race, setRace] = useState<ResolvedRace | null>(null);
  const [raceExtras, setRaceExtras] = useState<RaceExtras | null>(null);
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
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removingGoal, setRemovingGoal] = useState(false);
  const [removeGoalError, setRemoveGoalError] = useState<string | null>(null);
  const [chatterPreview, setChatterPreview] = useState<ChatterPreviewMessage[] | null>(null);
  const [chatterBlocked, setChatterBlocked] = useState(false);
  const [hubMemberCount, setHubMemberCount] = useState<number | null>(null);

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

  const loadRaceExtras = useCallback(async (raceRegistryId: string) => {
    try {
      const { data } = await api.get<{
        race?: {
          courseSlug?: string | null;
          courseMapUrl?: string | null;
        };
      }>(`/race-registry/${encodeURIComponent(raceRegistryId)}`);
      const r = data.race;
      setRaceExtras({
        courseSlug: r?.courseSlug ?? null,
        courseMapUrl: r?.courseMapUrl ?? null,
      });
    } catch {
      setRaceExtras(null);
    }
  }, []);

  const loadChatterPreview = useCallback(async (raceRegistryId: string) => {
    setChatterPreview(null);
    setChatterBlocked(false);
    setHubMemberCount(null);
    try {
      const msgRes = await api.get(`/race-hub/${encodeURIComponent(raceRegistryId)}/messages`);
      const rawList = msgRes.data?.messages;
      if (Array.isArray(rawList)) {
        const normalized = rawList
          .map((m: Record<string, unknown>) => normalizePreviewMessage(m))
          .filter((m): m is ChatterPreviewMessage => m != null);
        setChatterPreview(normalized.slice(-3).reverse());
      } else {
        setChatterPreview([]);
      }
    } catch {
      setChatterBlocked(true);
      setChatterPreview([]);
      try {
        const membersRes = await api.get(
          `/race-hub/${encodeURIComponent(raceRegistryId)}/members`
        );
        const list = membersRes.data?.memberships;
        if (Array.isArray(list)) {
          setHubMemberCount(list.length);
        }
      } catch {
        /* teaser without count */
      }
    }
  }, []);

  const loadSignupAndGoal = useCallback(
    async (raceRegistryId: string) => {
      setLoadingUser(true);
      try {
        const [suRes, gRes, plansRes, upcomingRes] = await Promise.all([
          api.get<{ signups: Signup[] }>("/race-signups"),
          api.get<{ goals: GoalRow[] }>("/goals?status=ACTIVE").catch(() => ({ data: { goals: [] as const } })),
          api
            .get<{ plans?: TrainingPlanRow[] }>("/training-plan?status=active")
            .catch(() => ({ data: { plans: [] } })),
          api
            .get<{ sessions?: UpcomingSession[]; activePlanSummary?: ActivePlanSummary | null }>(
              "/training/upcoming?limit=1"
            )
            .catch(() => ({ data: { sessions: [], activePlanSummary: null } })),
        ]);
        const su = (suRes.data.signups ?? []).find((s) => s.raceRegistryId === raceRegistryId) ?? null;
        setSignup(su);
        const goals = gRes.data.goals ?? [];
        const g =
          goals.find(
            (x) => x.raceRegistryId === raceRegistryId || x.race_registry?.id === raceRegistryId
          ) ?? null;
        setGoal(g);

        const plans = plansRes.data.plans ?? [];
        const planForGoal = g?.id ? plans.find((p) => p.athleteGoalId === g.id) ?? null : null;

        const summary = upcomingRes.data.activePlanSummary ?? null;
        const sessions = upcomingRes.data.sessions ?? [];
        if (planForGoal && summary) {
          setActivePlanSummary(summary);
          setNextSession(sessions[0] ?? null);
        } else {
          setActivePlanSummary(null);
          setNextSession(null);
        }

        if (su) {
          void loadRaceExtras(raceRegistryId);
          void loadChatterPreview(raceRegistryId);
        }
      } catch {
        setSignup(null);
        setGoal(null);
        setActivePlanSummary(null);
        setNextSession(null);
      } finally {
        setLoadingUser(false);
      }
    },
    [loadRaceExtras, loadChatterPreview]
  );

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
    goal && (goal.raceRegistryId === race.id || goal.race_registry?.id === race.id)
  );
  const hasSignup = Boolean(signup);
  const goalTimeDisplay = goal?.goalTime?.trim() || null;
  const resolvedGoalRacePace = resolveGoalRacePace({
    goalTime: goal?.goalTime,
    dbGoalRacePaceSecPerMile: goal?.goalRacePace ?? null,
    distanceMeters: race.distanceMeters,
    distanceLabel: race.distanceLabel,
  });
  const goalPaceDisplay = formatSecPerMile(resolvedGoalRacePace.goalPaceSecPerMile);
  const courseTipsUrl = getPublicCoursePageUrl(raceExtras?.courseSlug);
  const publicRaceUrl = getPublicRacePageUrl(race.slug);
  const hasCourseSection = Boolean(
    courseTipsUrl || raceExtras?.courseMapUrl || race.registrationUrl || publicRaceUrl
  );

  return (
    <div className="space-y-5">
      <Link
        href="/races"
        className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline"
      >
        <ChevronLeft className="w-4 h-4" />
        My Races
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {race.logoUrl ? (
          <div className="w-14 h-14 rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0">
            <img src={race.logoUrl} alt="" className="w-full h-full object-contain" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{race.name}</h1>
            <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-900 px-2.5 py-0.5 text-xs font-bold tabular-nums">
              {countdownChipLabel(race.raceDate)}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-sm text-gray-600">
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
            <p className="text-sm text-gray-700 mt-1">{race.distanceLabel}</p>
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
          {isGoalRace ? (
            <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Training
              </h2>
              {activePlanSummary?.hasSchedule &&
              activePlanSummary.weekNumber != null &&
              activePlanSummary.totalWeeks != null ? (
                <>
                  <p className="mt-2 text-base font-semibold text-gray-900">{activePlanSummary.name}</p>
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
                  <p className="mt-2 text-sm text-gray-800">
                    You have a <span className="font-bold tabular-nums">{goalTimeDisplay}</span> goal —
                    build the plan to get race-ready.
                  </p>
                  <Link
                    href={`/training-setup?goalId=${encodeURIComponent(goal!.id)}`}
                    className="mt-4 inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    Build a training plan →
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-600">
                  Set a goal time below, then start a training plan.
                </p>
              )}
            </section>
          ) : null}

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-orange-600" />
              Race chatter
            </h2>
            {chatterPreview === null ? (
              <p className="mt-2 text-sm text-gray-500">Loading conversation…</p>
            ) : chatterBlocked ? (
              <p className="mt-2 text-sm text-gray-600">
                {hubMemberCount != null && hubMemberCount > 0
                  ? `${hubMemberCount} runner${hubMemberCount === 1 ? "" : "s"} in the hub — join the conversation.`
                  : "See who else is running and swap tips in the race hub."}
              </p>
            ) : chatterPreview.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No messages yet — be the first to say hello.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {chatterPreview.map((m) => (
                  <li key={m.id} className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
                    <p className="font-semibold text-gray-900 text-xs">{displayName(m.athlete)}</p>
                    <p className="text-gray-700 mt-0.5 line-clamp-2">{m.content}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/race-hub/${race.id}`}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Join the conversation →
            </Link>
          </section>

          {hasCourseSection ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 flex items-center gap-2">
                <Route className="w-4 h-4 text-orange-600" />
                Know the course
              </h2>
              {raceExtras?.courseMapUrl ? (
                <a
                  href={raceExtras.courseMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
                >
                  <img
                    src={raceExtras.courseMapUrl}
                    alt="Course map"
                    className="w-full max-h-40 object-contain"
                  />
                </a>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {courseTipsUrl ? (
                  <a
                    href={courseTipsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Course tips
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : null}
                {publicRaceUrl ? (
                  <a
                    href={publicRaceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Full race info
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : null}
                {race.registrationUrl ? (
                  <a
                    href={race.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Register
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          {!isGoalRace ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-700 mb-3">
                Make this your goal race to set a target time and build a training plan around it.
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
              {makeGoalError ? <p className="mt-2 text-xs text-red-600">{makeGoalError}</p> : null}
            </section>
          ) : (
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
          )}

          {isGoalRace ? (
            <div className="pt-2 border-t border-gray-100">
              {!removeConfirmOpen ? (
                <button
                  type="button"
                  onClick={() => setRemoveConfirmOpen(true)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove as goal race
                </button>
              ) : (
                <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3">
                  <p className="text-sm text-gray-700">
                    Archive your goal for this race?
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRemoveGoal()}
                      disabled={removingGoal}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {removingGoal ? "Removing…" : "Yes, remove"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveConfirmOpen(false);
                        setRemoveGoalError(null);
                      }}
                      disabled={removingGoal}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                  {removeGoalError ? (
                    <p className="mt-2 text-xs text-red-600">{removeGoalError}</p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
