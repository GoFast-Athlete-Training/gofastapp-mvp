"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { Calendar, MapPin, X, Users, Flag, ChevronRight } from "lucide-react";
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

function ymdLocalFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdFromRaceIso(iso: string): string {
  return ymdLocalFromDate(new Date(iso));
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

function RaceMonthsCalendar({
  upcomingSignups,
}: {
  upcomingSignups: Signup[];
}) {
  const now = new Date();
  const raceByYmd = useMemo(() => {
    const m = new Map<string, Signup[]>();
    for (const su of upcomingSignups) {
      const key = ymdFromRaceIso(su.race_registry.raceDate);
      const list = m.get(key) ?? [];
      list.push(su);
      m.set(key, list);
    }
    return m;
  }, [upcomingSignups]);

  const months = useMemo(() => {
    const baseY = now.getFullYear();
    const baseM = now.getMonth();
    const out: { y: number; m: number }[] = [{ y: baseY, m: baseM }];

    const nextMonthStart = new Date(baseY, baseM + 1, 1);
    const hasInNext = upcomingSignups.some((s) => {
      const rd = new Date(s.race_registry.raceDate);
      return (
        rd.getFullYear() === nextMonthStart.getFullYear() &&
        rd.getMonth() === nextMonthStart.getMonth()
      );
    });
    if (hasInNext) {
      out.push({
        y: nextMonthStart.getFullYear(),
        m: nextMonthStart.getMonth(),
      });
    }
    return out;
  }, [upcomingSignups, now.getFullYear(), now.getMonth()]);

  const todayYmd = ymdLocalFromDate(now);

  return (
    <div className="space-y-8">
      {months.map(({ y, m }) => {
        const first = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0).getDate();
        const startPad = first.getDay();
        const label = first.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        const cells: (number | null)[] = [];
        for (let i = 0; i < startPad; i++) cells.push(null);
        for (let d = 1; d <= lastDay; d++) cells.push(d);

        return (
          <div key={`${y}-${m}`}>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{label}</h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="py-1 font-medium text-gray-500">
                  {d}
                </div>
              ))}
              {cells.map((day, idx) => {
                if (day == null) {
                  return <div key={`e-${idx}`} className="aspect-square min-h-[2.25rem]" />;
                }
                const ymd = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const races = raceByYmd.get(ymd);
                const isToday = ymd === todayYmd;

                return (
                  <div
                    key={ymd}
                    className={`aspect-square min-h-[2.25rem] flex flex-col items-center justify-center rounded-lg border text-sm ${
                      isToday
                        ? "border-orange-300 bg-orange-50 font-semibold text-orange-900"
                        : races
                          ? "border-violet-200 bg-violet-50/80"
                          : "border-transparent text-gray-700"
                    }`}
                  >
                    <span>{day}</span>
                    {races && races.length > 0 ? (
                      <div className="flex flex-col gap-0.5 mt-0.5 w-full px-0.5">
                        {races.slice(0, 2).map((su) => (
                          <Link
                            key={su.id}
                            href={personalRaceHref(su.race_registry)}
                            title={su.race_registry.name}
                            className="text-[10px] leading-tight font-semibold text-violet-800 hover:text-violet-950 truncate w-full flex items-center justify-center gap-0.5"
                          >
                            <span aria-hidden>🏁</span>
                            <span className="truncate max-w-[4.5rem] hidden sm:inline">
                              {su.race_registry.name}
                            </span>
                          </Link>
                        ))}
                        {races.length > 2 ? (
                          <span className="text-[9px] text-violet-600">+{races.length - 2}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SignupRaceCard({
  signup,
  variant,
  goalSummary,
  onRemove,
  removing,
}: {
  signup: Signup;
  variant: "default" | "compact";
  goalSummary?: { goalTime: string | null };
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const r = signup.race_registry;
  const isCompact = variant === "compact";
  return (
    <li
      className={`rounded-xl border shadow-sm relative ${
        isCompact
          ? "border-gray-200 bg-white p-3"
          : "border-orange-100 bg-white p-4"
      }`}
    >
      <button
        type="button"
        onClick={() => onRemove(signup.id)}
        disabled={removing}
        className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        aria-label="Remove from My Races"
      >
        <X className="w-4 h-4" />
      </button>
      <p
        className={`font-semibold text-gray-900 pr-7 leading-snug ${isCompact ? "text-sm" : ""}`}
      >
        {r.name}
      </p>
      <p className={`font-medium text-orange-600 ${isCompact ? "text-[11px] mt-1" : "text-xs mt-2"}`}>
        {countdownLabel(r.raceDate)}
      </p>
      {goalSummary?.goalTime ? (
        <p className={`text-gray-800 ${isCompact ? "text-xs mt-1" : "text-sm mt-1"}`}>
          Goal:{" "}
          <span className="font-mono font-semibold">{goalSummary.goalTime}</span>
        </p>
      ) : null}
      <p
        className={`text-gray-500 flex items-center gap-1 ${isCompact ? "text-[11px] mt-1" : "text-xs mt-1"}`}
      >
        <Calendar className="w-3 h-3 shrink-0" />
        {formatRaceListDate(r.raceDate)}
      </p>
      {(r.city || r.state) && (
        <p
          className={`text-gray-500 flex items-center gap-1 ${isCompact ? "text-[11px] mt-0.5" : "text-xs mt-0.5"}`}
        >
          <MapPin className="w-3 h-3 shrink-0" />
          {[r.city, r.state].filter(Boolean).join(", ")}
        </p>
      )}
      <p
        className={`text-gray-600 ${isCompact ? "text-[11px] mt-1.5" : "text-xs mt-2"}`}
      >
        {r.distanceLabel?.trim() ||
          (r.distanceMeters != null
            ? `${(r.distanceMeters / 1609.344).toFixed(1)} mi`
            : r.distanceMiles != null
              ? `${r.distanceMiles} mi · ${r.raceType ?? "—"}`
              : "—")}
      </p>
      <div
        className={`flex flex-wrap gap-2 ${isCompact ? "mt-2.5" : "mt-3"}`}
      >
        <Link
          href={personalRaceHref(r)}
          className={`inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold ${
            isCompact ? "text-xs px-2.5 py-1.5" : "text-sm px-3 py-2"
          }`}
        >
          My race
        </Link>
        <Link
          href={`/race-hub/${r.id}`}
          className={`inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 font-medium ${
            isCompact ? "text-xs px-2.5 py-1.5" : "text-sm px-3 py-2"
          }`}
        >
          <Users className="w-3.5 h-3.5 text-orange-600" />
          Hub
        </Link>
        {r.registrationUrl && !isCompact ? (
          <a
            href={r.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs font-medium text-orange-600 hover:underline py-2"
          >
            Registration
          </a>
        ) : null}
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

  const { heroSignup, otherSignups } = useMemo(() => {
    const heroRaceId = goals[0]?.raceRegistryId ?? goals[0]?.race_registry?.id ?? null;
    let hero: Signup | null = null;
    let others: Signup[] = [];
    if (heroRaceId) {
      for (const s of upcomingSignups) {
        if (s.raceRegistryId === heroRaceId) hero = s;
        else others.push(s);
      }
    } else {
      others = [...upcomingSignups];
    }
    return { heroSignup: hero, otherSignups: others };
  }, [upcomingSignups, goals]);

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
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Races</h1>
        <p className="text-gray-600 text-sm mt-1 max-w-2xl">
          Your goal race up front, calendar below, and the hub for community & shakeouts.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading your races…</p>
      ) : signups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-10 text-center text-sm text-gray-600">
          <p>No races on your calendar yet.</p>
          <Link
            href="/races/find"
            className="inline-flex items-center justify-center mt-4 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Looking for more races
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      ) : (
        <>
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
                    Primary race & goal
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

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {heroGoal?.goalTime?.trim() ? (
                      <span className="inline-flex items-center rounded-full border border-orange-200 bg-white px-3 py-1 text-sm font-mono font-semibold text-gray-900">
                        Goal {heroGoal.goalTime.trim()}
                      </span>
                    ) : (
                      <Link
                        href={personalRaceHref(heroSignup.race_registry)}
                        className="inline-flex items-center rounded-full border border-dashed border-orange-300 bg-white px-3 py-1 text-sm font-semibold text-orange-800 hover:bg-orange-50"
                      >
                        Set goal →
                      </Link>
                    )}

                    {activePlanSummary?.hasSchedule &&
                    activePlanSummary.weekNumber != null &&
                    activePlanSummary.totalWeeks != null ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-900 px-3 py-1 text-xs font-bold">
                        Week {activePlanSummary.weekNumber} of {activePlanSummary.totalWeeks}
                      </span>
                    ) : (
                      <Link
                        href={
                          heroGoal?.id
                            ? `/training-setup?goalId=${encodeURIComponent(heroGoal.id)}`
                            : "/training-setup"
                        }
                        className="inline-flex items-center rounded-full bg-gray-900 text-white px-3 py-1 text-xs font-bold hover:bg-gray-800"
                      >
                        Start a plan →
                      </Link>
                    )}

                    <span className="text-xs text-gray-500 w-full sm:w-auto sm:ml-1">
                      Plan miles: <span className="font-medium text-gray-400">—</span>{" "}
                      <span className="italic">(coming soon)</span>
                    </span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/race-hub/${heroSignup.race_registry.id}`}
                      className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 shadow-sm"
                    >
                      Visit hub
                    </Link>
                    <Link
                      href={personalRaceHref(heroSignup.race_registry)}
                      className="inline-flex items-center justify-center rounded-xl border-2 border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      My race page
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          ) : goals.length > 0 ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              You have an active goal, but that race isn&apos;t on your calendar yet.{" "}
              <Link href="/races/find" className="font-semibold underline">
                Find the race
              </Link>{" "}
              and add it.
            </p>
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
                    variant="compact"
                    onRemove={onRemove}
                    removing={removingSignupId === s.id}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {upcomingSignups.length > 0 ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Race calendar</h2>
              <p className="text-xs text-gray-500 mb-5">
                🏁 marks race day — tap to open your race page.
              </p>
              <RaceMonthsCalendar upcomingSignups={upcomingSignups} />
            </section>
          ) : null}

          {pastSignups.length > 0 ? (
            <section className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Past races
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {pastSignups.length} past race{pastSignups.length === 1 ? "" : "s"} —{" "}
                {pastSignups.map((s) => s.race_registry.name).join(", ")}
              </p>
            </section>
          ) : null}

          <div className="pb-4">
            <Link
              href="/races/find"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border-2 border-orange-200 bg-white px-5 py-3 text-sm font-bold text-orange-900 hover:bg-orange-50"
            >
              Looking for more races
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
