"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import {
  Calendar,
  MapPin,
  Flag,
  ChevronLeft,
  Zap,
  Trash2,
  ExternalLink,
  Route,
} from "lucide-react";
import { formatRaceListDate, daysUntilRace } from "@/lib/races-display";
import { RacePaceHubTabs } from "@/components/races/RacePaceHubTabs";
import { InlineGoalForm } from "@/components/races/InlineGoalForm";
import {
  getPublicCoursePageUrl,
  getPublicRacePageUrl,
} from "@/lib/public-race-url";
import { resolveMyRacePlannerDistance } from "@/lib/races/myrace-planner-distance";
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
  summaryPhrase?: string | null;
  description?: string | null;
};

type RaceExtras = {
  courseSlug: string | null;
  courseMapUrl: string | null;
};

type Signup = {
  id: string;
  raceRegistryId: string;
  isPrimaryRace?: boolean;
  trainingPlanId?: string | null;
  goalTime?: string | null;
  goalRacePace?: number | null;
  goalPace5K?: number | null;
  distanceLabel?: string | null;
  distanceMeters?: number | null;
};

type GoalRow = {
  id: string;
  name?: string | null;
  goalTime?: string | null;
  goalRacePace?: number | null;
  goalPace5K?: number | null;
  athleteRaceId?: string | null;
  raceRegistryId?: string | null;
  athlete_race?: { id: string; raceRegistryId?: string } | null;
  race_registry?: { id: string } | null;
};

type ActivePlanSummary = {
  name: string;
  hasSchedule: boolean;
  weekNumber: number | null;
  totalWeeks: number | null;
};

type TrainingPlanRow = {
  id: string;
  name: string;
  athleteRaceId: string | null;
};

function countdownChipLabel(iso: string): string {
  const d = daysUntilRace(iso);
  if (d < 0) return "Past race";
  if (d === 0) return "Race day!";
  if (d === 1) return "1 day to go";
  if (d <= 14) return `${d} days to go`;
  const w = Math.ceil(d / 7);
  return `${w} week${w === 1 ? "" : "s"} to go`;
}

export default function MyRacePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const expandPlanFromQuery =
    searchParams.get("plan") === "1" || searchParams.get("plan") === "true";

  const [race, setRace] = useState<ResolvedRace | null>(null);
  const [raceExtras, setRaceExtras] = useState<RaceExtras | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [loadingRace, setLoadingRace] = useState(true);
  const [signup, setSignup] = useState<Signup | null>(null);
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [makingGoal, setMakingGoal] = useState(false);
  const [makeGoalError, setMakeGoalError] = useState<string | null>(null);
  const paceSectionRef = useRef<HTMLDivElement | null>(null);
  const [activePlanSummary, setActivePlanSummary] = useState<ActivePlanSummary | null>(null);
  const [trainingPlanId, setTrainingPlanId] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removingGoal, setRemovingGoal] = useState(false);
  const [removeGoalError, setRemoveGoalError] = useState<string | null>(null);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [addCalendarError, setAddCalendarError] = useState<string | null>(null);

  useEffect(() => {
    if (!expandPlanFromQuery || loadingUser || !signup?.id) return;
    const t = window.setTimeout(() => {
      paceSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [expandPlanFromQuery, loadingUser, signup?.id]);

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

  const loadSignupAndGoal = useCallback(
    async (raceRegistryId: string) => {
      setLoadingUser(true);
      try {
        const [suRes, gRes, plansRes, upcomingRes] = await Promise.all([
          api.get<{
            signups: Signup[];
            athleteRaces?: Signup[];
          }>("/athlete-races"),
          api.get<{ goals: GoalRow[] }>("/goals?status=ACTIVE").catch(() => ({ data: { goals: [] as const } })),
          api
            .get<{ plans?: TrainingPlanRow[] }>("/training-plan?status=active")
            .catch(() => ({ data: { plans: [] } })),
          api
            .get<{ activePlanSummary?: ActivePlanSummary | null }>("/training/upcoming?limit=1")
            .catch(() => ({ data: { activePlanSummary: null } })),
        ]);
        const su =
          (suRes.data.athleteRaces ?? suRes.data.signups ?? []).find(
            (s) => s.raceRegistryId === raceRegistryId
          ) ?? null;
        setSignup(su);
        const goals = gRes.data.goals ?? [];
        const g =
          goals.find(
            (x) =>
              (su && x.athleteRaceId === su.id) ||
              x.raceRegistryId === raceRegistryId ||
              x.race_registry?.id === raceRegistryId
          ) ?? null;
        setGoal(g);

        const plans = plansRes.data.plans ?? [];
        const athleteRaceId = su?.id ?? null;
        const planForRace = athleteRaceId
          ? plans.find((p) => p.athleteRaceId === athleteRaceId) ?? null
          : null;
        const resolvedTrainingPlanId = planForRace?.id ?? null;
        setTrainingPlanId(resolvedTrainingPlanId);

        const summary = upcomingRes.data.activePlanSummary ?? null;
        if (resolvedTrainingPlanId && summary?.hasSchedule) {
          setActivePlanSummary(summary);
        } else {
          setActivePlanSummary(null);
        }

        if (su) {
          void loadRaceExtras(raceRegistryId);
        }
      } catch {
        setSignup(null);
        setGoal(null);
        setTrainingPlanId(null);
        setActivePlanSummary(null);
      } finally {
        setLoadingUser(false);
      }
    },
    [loadRaceExtras]
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

  async function handleAddToCalendar() {
    if (!race) return;
    setAddingToCalendar(true);
    setAddCalendarError(null);
    try {
      const claimRes = await api.post<{ signup?: Signup; athleteRace?: Signup }>(
        "/athlete-races",
        { raceRegistryId: race.id },
      );
      const athleteRace =
        claimRes.data.athleteRace ?? claimRes.data.signup ?? null;
      if (!athleteRace?.id) {
        throw new Error("Could not add this race to your calendar");
      }
      setSignup({ id: athleteRace.id, raceRegistryId: race.id });
      void loadSignupAndGoal(race.id);
    } catch (err: unknown) {
      setAddCalendarError(
        err instanceof Error ? err.message : "Failed to add race — try again",
      );
    } finally {
      setAddingToCalendar(false);
    }
  }

  async function handleMakeGoalRace() {
    if (!race) return;
    setMakingGoal(true);
    setMakeGoalError(null);
    try {
      let athleteRaceId = signup?.id;
      if (!athleteRaceId) {
        const claimRes = await api.post<{ signup?: Signup; athleteRace?: Signup }>(
          "/athlete-races",
          { raceRegistryId: race.id }
        );
        athleteRaceId =
          claimRes.data.athleteRace?.id ?? claimRes.data.signup?.id ?? undefined;
        if (athleteRaceId) {
          setSignup({ id: athleteRaceId, raceRegistryId: race.id });
        }
      }
      if (!athleteRaceId) {
        throw new Error("Add this race to My Races first");
      }
      await api.patch(`/athlete-races/${encodeURIComponent(athleteRaceId)}`, {
        isPrimaryRace: true,
      });
      setSignup((prev) =>
        prev ? { ...prev, id: athleteRaceId!, isPrimaryRace: true } : { id: athleteRaceId!, raceRegistryId: race.id, isPrimaryRace: true }
      );
      if (race.id) void loadSignupAndGoal(race.id);
    } catch (err: unknown) {
      setMakeGoalError(err instanceof Error ? err.message : "Failed — try again");
    } finally {
      setMakingGoal(false);
    }
  }

  async function handleRemoveGoal() {
    if (!signup?.id) return;
    setRemovingGoal(true);
    setRemoveGoalError(null);
    try {
      await api.patch(`/athlete-races/${encodeURIComponent(signup.id)}`, {
        isPrimaryRace: false,
      });
      setSignup((prev) => (prev ? { ...prev, isPrimaryRace: false } : prev));
    } catch (err: unknown) {
      setRemoveGoalError(err instanceof Error ? err.message : "Could not unmark Goal race");
    } finally {
      setRemovingGoal(false);
      setRemoveConfirmOpen(false);
    }
  }

  const plannerDistance = useMemo(
    () =>
      race
        ? resolveMyRacePlannerDistance({
            registryMeters: race.distanceMeters,
            registryLabel: race.distanceLabel,
            claimMeters: signup?.distanceMeters,
            claimLabel: signup?.distanceLabel,
            slug: race.slug ?? slug,
            raceName: race.name,
          })
        : { distanceLabel: null as string | null, distanceMeters: null as number | null },
    [
      race,
      signup?.distanceMeters,
      signup?.distanceLabel,
      slug,
    ]
  );

  const effectiveGoal = useMemo((): GoalRow | null => {
    if (!signup) return goal;
    const gTime = goal?.goalTime?.trim() || signup.goalTime?.trim() || null;
    const gPace = goal?.goalRacePace ?? signup.goalRacePace ?? null;
    const g5k = goal?.goalPace5K ?? signup.goalPace5K ?? null;
    if (!gTime && (gPace == null || gPace <= 0) && !goal) return null;
    return {
      id: goal?.id ?? signup.id,
      goalTime: gTime,
      goalRacePace: gPace,
      goalPace5K: g5k,
      athleteRaceId: signup.id,
      raceRegistryId: signup.raceRegistryId,
    };
  }, [goal, signup]);

  const raceForGoal =
    race && signup
      ? {
          athleteRaceId: signup.id,
          name: race.name,
          raceDate: race.raceDate,
          distanceLabel: plannerDistance.distanceLabel,
          distanceMeters: plannerDistance.distanceMeters,
        }
      : null;

  const goalTimeDisplay =
    goal?.goalTime?.trim() || signup?.goalTime?.trim() || null;

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
  const isGoalRace = Boolean(signup?.isPrimaryRace);
  const hasPlanForRace = Boolean(trainingPlanId);
  const hasSignup = Boolean(signup);
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
          <p className="text-xs font-bold uppercase tracking-wide text-orange-700">My Race Hub</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
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
        <div className="space-y-4">
          {(race.summaryPhrase?.trim() || race.description?.trim()) ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              {race.summaryPhrase?.trim() ? (
                <p className="text-base font-medium text-gray-900">{race.summaryPhrase.trim()}</p>
              ) : null}
              {race.description?.trim() ? (
                <p
                  className={`text-sm text-gray-700 leading-relaxed ${
                    race.summaryPhrase?.trim() ? "mt-2" : ""
                  }`}
                >
                  {race.description.trim().length > 320
                    ? `${race.description.trim().slice(0, 320)}…`
                    : race.description.trim()}
                </p>
              ) : null}
              {publicRaceUrl ? (
                <a
                  href={publicRaceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  See more
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
            </section>
          ) : publicRaceUrl ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <a
                href={publicRaceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                See full race info
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </section>
          ) : null}

          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
            <p className="font-medium">This race isn&apos;t on your calendar yet.</p>
            <p className="mt-1 text-amber-900/90">
              Add it to track training and goal race settings.
            </p>
            <button
              type="button"
              onClick={() => void handleAddToCalendar()}
              disabled={addingToCalendar}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {addingToCalendar ? "Adding…" : "Add to calendar"}
            </button>
            {addCalendarError ? (
              <p className="mt-2 text-xs text-red-700">{addCalendarError}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {hasCourseSection ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 flex items-center gap-2">
                <Route className="w-4 h-4 text-orange-600" />
                Course overview
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

          {raceForGoal ? (
            <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm space-y-5">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Plan for it
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Set your goal time and pacing here — no need to open training setup for race-week prep.
                </p>
              </div>

              <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50/80 to-white p-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-orange-900">Your goal</h3>
                <p className="mt-1 text-sm text-gray-600">Finish time — updates your pace below.</p>
                <div className="mt-3">
                  <InlineGoalForm
                    race={raceForGoal}
                    goal={effectiveGoal}
                    onSaved={(g) => {
                      setGoal(g);
                      setSignup((prev) =>
                        prev
                          ? {
                              ...prev,
                              goalTime: g.goalTime ?? prev.goalTime,
                              goalRacePace: g.goalRacePace ?? prev.goalRacePace,
                              goalPace5K: g.goalPace5K ?? prev.goalPace5K,
                            }
                          : prev
                      );
                    }}
                    alwaysShowForm
                  />
                </div>
              </div>

              <div
                ref={paceSectionRef}
                id="your-pace"
                className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 scroll-mt-4"
              >
                <RacePaceHubTabs
                  raceForGoal={raceForGoal}
                  goal={effectiveGoal}
                  defaultTab="build"
                  racePlanContext={
                    signup?.id && raceForGoal?.raceDate
                      ? {
                          athleteRaceId: signup.id,
                          raceDate: String(raceForGoal.raceDate).slice(0, 10),
                          planId: trainingPlanId,
                          title: raceForGoal.name,
                        }
                      : undefined
                  }
                />
              </div>

              {hasPlanForRace ? (
                <p className="text-sm text-gray-600">
                  Training schedule:{" "}
                  <Link
                    href={
                      activePlanSummary?.hasSchedule
                        ? "/training"
                        : `/training-setup/${encodeURIComponent(trainingPlanId!)}`
                    }
                    className="font-semibold text-emerald-800 hover:underline"
                  >
                    {activePlanSummary?.hasSchedule ? "Open training hub" : "Finish plan setup"}
                  </Link>
                </p>
              ) : goalTimeDisplay ? (
                <p className="text-sm text-gray-600">
                  Optional:{" "}
                  <Link
                    href={`/training-setup?athleteRaceId=${encodeURIComponent(signup!.id)}`}
                    className="font-semibold text-emerald-800 hover:underline"
                  >
                    Add a training plan
                  </Link>{" "}
                  for this race.
                </p>
              ) : null}
            </section>
          ) : null}

          {!isGoalRace ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-700 mb-3">
                Mark this as your Goal race so friends can cheer you on in the public race hub.
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
          ) : null}

          {isGoalRace ? (
            <div className="pt-2 border-t border-gray-100">
              {!removeConfirmOpen ? (
                <button
                  type="button"
                  onClick={() => setRemoveConfirmOpen(true)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove as Goal race
                </button>
              ) : (
                <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3">
                  <p className="text-sm text-gray-700">
                    Unmark this as your Goal race? Your race stays in My Races and any time goal
                    you set is kept.
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

          <p className="text-center pt-2">
            <Link
              href={`/race-hub/${race.id}`}
              className="text-sm font-medium text-gray-500 hover:text-orange-600 hover:underline"
            >
              Race hub
            </Link>
            <span className="text-gray-400 text-sm"> — public chatter &amp; crew</span>
          </p>
        </>
      )}
    </div>
  );
}
