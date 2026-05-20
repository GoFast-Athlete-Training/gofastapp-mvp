"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { Calendar, MapPin, X, Flag, ChevronRight } from "lucide-react";
import {
  countdownLabel,
  daysUntilRace,
  formatRaceListDate,
} from "@/lib/races-display";
type RaceRegistryRow = {
  id: string;
  name: string;
  slug: string | null;
  distanceLabel: string | null;
  distanceMeters: number | null;
  raceDate: string;
  city: string | null;
  state: string | null;
  registrationUrl: string | null;
  startTime?: string | null;
  logoUrl?: string | null;
  raceType?: string;
  distanceMiles?: number;
};

type Signup = {
  id: string;
  raceRegistryId: string;
  race_registry: RaceRegistryRow;
};

type GoalRow = {
  id: string;
  name?: string | null;
  goalTime?: string | null;
  raceRegistryId?: string | null;
  race_registry?: { id: string; name?: string | null } | null;
};

type ActivePlanSummary = {
  name: string;
  hasSchedule: boolean;
  weekNumber: number | null;
  totalWeeks: number | null;
};

function personalRaceHref(r: RaceRegistryRow): string {
  const s = r.slug?.trim();
  return s ? `/myrace/${encodeURIComponent(s)}` : `/race-hub/${r.id}`;
}

function bigCountdownLabel(iso: string): string {
  const d = daysUntilRace(iso);
  if (d < 0) return "Past race";
  if (d === 0) return "Race day!";
  if (d === 1) return "1 day to go";
  if (d <= 14) return `${d} days to go`;
  const w = Math.ceil(d / 7);
  return `${w} week${w === 1 ? "" : "s"} to go`;
}

/** Next 6 calendar months from today, each a compact card with race list. */
function NextSixMonthsRaceCards({
  upcomingSignups,
}: {
  upcomingSignups: Signup[];
}) {
  const windowMonths = useMemo(() => {
    const d0 = new Date();
    const out: { y: number; m: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(d0.getFullYear(), d0.getMonth() + i, 1);
      out.push({ y: d.getFullYear(), m: d.getMonth() });
    }
    return out;
  }, []);

  const byMonth = useMemo(() => {
    const m = new Map<string, Signup[]>();
    for (const su of upcomingSignups) {
      const rd = new Date(su.race_registry.raceDate);
      const key = `${rd.getFullYear()}-${rd.getMonth()}`;
      const list = m.get(key) ?? [];
      list.push(su);
      m.set(key, list);
    }
    for (const [, list] of m) {
      list.sort(
        (a, b) =>
          new Date(a.race_registry.raceDate).getTime() -
          new Date(b.race_registry.raceDate).getTime()
      );
    }
    return m;
  }, [upcomingSignups]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
      {windowMonths.map(({ y, m }) => {
        const key = `${y}-${m}`;
        const races = byMonth.get(key) ?? [];
        const label = new Date(y, m, 1).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
        return (
          <div
            key={key}
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm min-h-[5.5rem] flex flex-col"
          >
            <p className="text-[11px] font-bold text-gray-800 uppercase tracking-wide mb-2">
              {label}
            </p>
            {races.length === 0 ? (
              <p className="text-[11px] text-gray-400 mt-auto">—</p>
            ) : (
              <ul className="space-y-1.5 flex-1">
                {races.map((su) => {
                  const dayNum = new Date(su.race_registry.raceDate).getDate();
                  return (
                    <li key={su.id}>
                      <Link
                        href={personalRaceHref(su.race_registry)}
                        className="text-[11px] text-orange-800 hover:text-orange-950 hover:underline font-medium flex gap-1 min-w-0"
                        title={su.race_registry.name}
                      >
                        <span className="text-gray-500 tabular-nums shrink-0">{dayNum}</span>
                        <span className="truncate">{su.race_registry.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SignupRaceCard({
  signup,
  goalSummary,
  onRemove,
  removing,
}: {
  signup: Signup;
  goalSummary?: { goalTime: string | null };
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const r = signup.race_registry;
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm relative">
      <button
        type="button"
        onClick={() => onRemove(signup.id)}
        disabled={removing}
        className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        aria-label="Remove from My Races"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="font-semibold text-gray-900 pr-7 leading-snug text-sm">{r.name}</p>
      <p className="font-medium text-orange-600 text-[11px] mt-1">{countdownLabel(r.raceDate)}</p>
      {goalSummary?.goalTime ? (
        <p className="text-gray-800 text-xs mt-1">
          Goal: <span className="font-mono font-semibold">{goalSummary.goalTime}</span>
        </p>
      ) : null}
      <p className="text-gray-500 flex items-center gap-1 text-[11px] mt-1">
        <Calendar className="w-3 h-3 shrink-0" />
        {formatRaceListDate(r.raceDate)}
      </p>
      {(r.city || r.state) && (
        <p className="text-gray-500 flex items-center gap-1 text-[11px] mt-0.5">
          <MapPin className="w-3 h-3 shrink-0" />
          {[r.city, r.state].filter(Boolean).join(", ")}
        </p>
      )}
      <p className="text-gray-600 text-[11px] mt-1.5">
        {r.distanceLabel?.trim() ||
          (r.distanceMeters != null
            ? `${(r.distanceMeters / 1609.344).toFixed(1)} mi`
            : r.distanceMiles != null
              ? `${r.distanceMiles} mi · ${r.raceType ?? "—"}`
              : "—")}
      </p>
      <div className="mt-2.5">
        <Link
          href={personalRaceHref(r)}
          className="inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-2.5 py-1.5"
        >
          Get Ready →
        </Link>
      </div>
    </li>
  );
}

export default function MyRacesPage() {
  const router = useRouter();
  const [signups, setSignups] = useState<Signup[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [activePlanSummary, setActivePlanSummary] = useState<ActivePlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingSignupId, setRemovingSignupId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [suRes, gRes, upRes] = await Promise.all([
        api.get<{ signups: Signup[] }>("/race-signups"),
        api.get<{ goals: GoalRow[] }>("/goals?status=ACTIVE").catch(() => ({ data: { goals: [] } })),
        api
          .get<{ activePlanSummary?: ActivePlanSummary | null }>("/training/upcoming?limit=1")
          .catch(() => ({
            data: { activePlanSummary: undefined as ActivePlanSummary | null | undefined },
          })),
      ]);
      setSignups(suRes.data.signups ?? []);
      setGoals(gRes.data.goals ?? []);
      const s = upRes.data?.activePlanSummary;
      setActivePlanSummary(
        s && typeof s.name === "string"
          ? {
              name: s.name,
              hasSchedule: Boolean(s.hasSchedule),
              weekNumber: s.weekNumber ?? null,
              totalWeeks: s.totalWeeks ?? null,
            }
          : null
      );
    } catch (e) {
      console.error(e);
      setSignups([]);
      setGoals([]);
      setActivePlanSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) router.replace("/signup");
    });
    return () => unsub();
  }, [router]);

  const goalByRegistryId = useMemo(() => {
    const m = new Map<string, GoalRow>();
    for (const g of goals) {
      const rid = g.raceRegistryId ?? g.race_registry?.id;
      if (rid) m.set(rid, g);
    }
    return m;
  }, [goals]);

  const { upcomingSignups, pastSignups } = useMemo(() => {
    const up: Signup[] = [];
    const past: Signup[] = [];
    for (const s of signups) {
      if (daysUntilRace(s.race_registry.raceDate) >= 0) up.push(s);
      else past.push(s);
    }
    return { upcomingSignups: up, pastSignups: past };
  }, [signups]);

  const upcomingSorted = useMemo(
    () =>
      [...upcomingSignups].sort(
        (a, b) =>
          new Date(a.race_registry.raceDate).getTime() -
          new Date(b.race_registry.raceDate).getTime()
      ),
    [upcomingSignups]
  );

  const goalRaceId = goals[0]?.raceRegistryId ?? goals[0]?.race_registry?.id ?? null;

  const { heroSignup, otherSignups } = useMemo(() => {
    let hero: Signup | null = null;
    if (goalRaceId) {
      hero = upcomingSorted.find((s) => s.raceRegistryId === goalRaceId) ?? null;
    }
    if (!hero && upcomingSorted.length > 0) {
      hero = upcomingSorted[0] ?? null;
    }
    const others = upcomingSorted.filter((s) => s.id !== hero?.id);
    return { heroSignup: hero, otherSignups: others };
  }, [upcomingSorted, goalRaceId]);

  const goalOnCalendar = Boolean(
    goalRaceId && upcomingSignups.some((s) => s.raceRegistryId === goalRaceId)
  );

  async function onRemove(signupId: string) {
    setRemovingSignupId(signupId);
    try {
      await api.delete(`/race-signups/${signupId}`);
      setSignups((prev) => prev.filter((s) => s.id !== signupId));
    } catch (e) {
      console.error(e);
    } finally {
      setRemovingSignupId(null);
    }
  }

  const heroGoal = heroSignup ? goalByRegistryId.get(heroSignup.raceRegistryId) ?? null : null;

  return (
    <div className="space-y-8">
      {loading ? (
        <p className="text-gray-500 text-sm">Loading your races…</p>
      ) : signups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-10 text-center text-sm text-gray-600">
          <div className="flex justify-end mb-4">
            <Link
              href="/races/find"
              className="text-xs font-semibold text-orange-700 hover:underline"
            >
              Find more races →
            </Link>
          </div>
          <p>No races on your calendar yet.</p>
          <Link
            href="/races/find"
            className="inline-flex items-center justify-center mt-4 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Add a race
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Races</h1>
              <p className="text-gray-600 text-sm mt-1 max-w-xl">
                Your race schedule — tap any race for your personal dashboard.
              </p>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 text-sm">
              <Link
                href="/races/find"
                className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 shadow-sm"
              >
                Find more races →
              </Link>
              {pastSignups.length > 0 ? (
                <details className="group rounded-lg border border-gray-200 bg-white px-2 py-1.5 sm:max-w-xs sm:text-right">
                  <summary className="cursor-pointer list-none text-xs font-medium text-gray-600 hover:text-gray-900 [&::-webkit-details-marker]:hidden">
                    Past races ({pastSignups.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-left border-t border-gray-100 pt-2 max-h-40 overflow-y-auto">
                    {[...pastSignups]
                      .sort(
                        (a, b) =>
                          new Date(b.race_registry.raceDate).getTime() -
                          new Date(a.race_registry.raceDate).getTime()
                      )
                      .map((s) => (
                        <li key={s.id} className="text-xs text-gray-700">
                          <span className="text-gray-400 tabular-nums mr-1">
                            {formatRaceListDate(s.race_registry.raceDate)}
                          </span>
                          {s.race_registry.name}
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>
          {goals.length > 0 && goalRaceId && !goalOnCalendar && upcomingSignups.length > 0 ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Your active goal is for a race that isn&apos;t on this calendar yet.{" "}
              <Link href="/races/find" className="font-semibold underline">
                Add it
              </Link>{" "}
              or adjust your goal on the primary race below.
            </p>
          ) : null}

          {goals.length > 0 && upcomingSignups.length === 0 ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              You have an active goal, but no upcoming races on your calendar.{" "}
              <Link href="/races/find" className="font-semibold underline">
                Find the race
              </Link>{" "}
              and add it.
            </p>
          ) : null}

          {heroSignup ? (
            <section className="rounded-3xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50/50 p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                {heroSignup.race_registry.logoUrl ? (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-orange-100 bg-white overflow-hidden shrink-0 shadow-sm">
                    <img
                      src={heroSignup.race_registry.logoUrl}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-800 flex items-center gap-2">
                    <Flag className="w-4 h-4" />
                    {heroGoal?.goalTime?.trim() ? "Primary race & goal" : "Primary race"}
                  </p>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                    {heroSignup.race_registry.name}
                  </h2>
                  <p className="mt-3 text-3xl sm:text-4xl font-black tabular-nums text-orange-600 tracking-tight">
                    {bigCountdownLabel(heroSignup.race_registry.raceDate)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatRaceListDate(heroSignup.race_registry.raceDate)}
                    </span>
                    {heroSignup.race_registry.city || heroSignup.race_registry.state ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {[heroSignup.race_registry.city, heroSignup.race_registry.state]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    ) : null}
                    {heroSignup.race_registry.distanceLabel?.trim() ? (
                      <span className="font-medium text-gray-800">
                        {heroSignup.race_registry.distanceLabel}
                      </span>
                    ) : null}
                  </div>

                  {heroGoal?.goalTime?.trim() ? (
                    <div className="mt-5">
                      <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-900 px-3 py-1.5 text-sm font-bold tabular-nums">
                        Goal {heroGoal.goalTime.trim()}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {activePlanSummary?.hasSchedule &&
                    activePlanSummary.weekNumber != null &&
                    activePlanSummary.totalWeeks != null ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-900 px-3 py-1 text-xs font-bold">
                        Week {activePlanSummary.weekNumber} of {activePlanSummary.totalWeeks}
                      </span>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Link
                          href={
                            heroGoal?.id && heroGoal.goalTime?.trim()
                              ? `/training-setup?goalId=${encodeURIComponent(heroGoal.id)}`
                              : "/training-setup"
                          }
                          className="inline-flex items-center rounded-full bg-gray-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-gray-800 w-fit"
                        >
                          {heroGoal?.goalTime?.trim()
                            ? "Start a training plan"
                            : "Set a goal time above, then start a training plan"}
                        </Link>
                        {!heroGoal?.goalTime?.trim() ? (
                          <span className="text-xs text-gray-500">
                            Plans work best once you have a target finish time.
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={personalRaceHref(heroSignup.race_registry)}
                      className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 shadow-sm"
                    >
                      Get Ready →
                    </Link>
                    <Link
                      href={`/race-hub/${heroSignup.race_registry.id}`}
                      className="inline-flex items-center justify-center rounded-xl border-2 border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Join Others Racing This →
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {otherSignups.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                {heroSignup ? "Other races" : "Your races"}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {otherSignups.map((s) => (
                  <SignupRaceCard
                    key={s.id}
                    signup={s}
                    goalSummary={{
                      goalTime: goalByRegistryId.get(s.raceRegistryId)?.goalTime?.trim() || null,
                    }}
                    onRemove={onRemove}
                    removing={removingSignupId === s.id}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {upcomingSignups.length > 0 ? (
            <section className="pt-6 border-t border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Next few months</h2>
              <p className="text-xs text-gray-500 mb-3">
                Quick view — tap a race to open your dashboard.
              </p>
              <NextSixMonthsRaceCards upcomingSignups={upcomingSignups} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
