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
import DiscoverRacesSection from "@/components/races/DiscoverRacesSection";
import {
  InlineGoalForm,
  type InlineGoalRow,
  type RaceForGoal,
} from "@/components/races/InlineGoalForm";
import { pickHeroAthleteRace } from "@/lib/races/my-races-hero";
import { trainingPlanCtaForRace } from "@/lib/races/training-plan-cta";

type ApiAthleteRace = {
  id: string;
  raceRegistryId: string;
  name: string;
  raceDate: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  city: string | null;
  state: string | null;
  goalTime?: string | null;
  goalRacePace?: number | null;
  goalPace5K?: number | null;
  isPrimaryRace?: boolean;
  trainingPlanId?: string | null;
  race_registry?: {
    id: string;
    slug: string | null;
    logoUrl: string | null;
  } | null;
};

type AthleteRaceRow = {
  athleteRaceId: string;
  raceRegistryId: string;
  name: string;
  raceDate: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  city: string | null;
  state: string | null;
  slug: string | null;
  logoUrl: string | null;
  goalTime: string | null;
  goalRacePace: number | null;
  goalPace5K: number | null;
  isPrimaryRace: boolean;
  trainingPlanId: string | null;
};

function goalFromRace(row: AthleteRaceRow): InlineGoalRow | null {
  if (!row.goalTime?.trim()) return null;
  return {
    id: row.athleteRaceId,
    goalTime: row.goalTime,
    goalRacePace: row.goalRacePace,
    goalPace5K: row.goalPace5K,
    athleteRaceId: row.athleteRaceId,
    raceRegistryId: row.raceRegistryId,
  };
}

function isoRaceDate(value: string | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

function normalizeAthleteRace(raw: ApiAthleteRace): AthleteRaceRow {
  return {
    athleteRaceId: raw.id,
    raceRegistryId: raw.raceRegistryId,
    name: raw.name,
    raceDate: isoRaceDate(raw.raceDate),
    distanceLabel: raw.distanceLabel ?? null,
    distanceMeters: raw.distanceMeters ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    slug: raw.race_registry?.slug ?? null,
    logoUrl: raw.race_registry?.logoUrl ?? null,
    goalTime: raw.goalTime?.trim() || null,
    goalRacePace: raw.goalRacePace ?? null,
    goalPace5K: raw.goalPace5K ?? null,
    isPrimaryRace: raw.isPrimaryRace ?? false,
    trainingPlanId: raw.trainingPlanId ?? null,
  };
}

function personalRaceHref(row: AthleteRaceRow): string {
  const s = row.slug?.trim();
  return s ? `/myrace/${encodeURIComponent(s)}` : `/race-hub/${row.raceRegistryId}`;
}

function raceForGoal(row: AthleteRaceRow): RaceForGoal {
  return {
    athleteRaceId: row.athleteRaceId,
    name: row.name,
    raceDate: row.raceDate,
    distanceLabel: row.distanceLabel,
    distanceMeters: row.distanceMeters,
  };
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

function heroPrimaryCta(row: AthleteRaceRow, myRaceHref: string): { href: string; label: string } {
  return trainingPlanCtaForRace({
    athleteRaceId: row.athleteRaceId,
    trainingPlanId: row.trainingPlanId,
    goalTime: row.goalTime,
    myRaceHref,
  });
}

function NextSixMonthsRaceCards({
  upcomingRaces,
}: {
  upcomingRaces: AthleteRaceRow[];
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
    const m = new Map<string, AthleteRaceRow[]>();
    for (const row of upcomingRaces) {
      const rd = new Date(row.raceDate);
      const key = `${rd.getFullYear()}-${rd.getMonth()}`;
      const list = m.get(key) ?? [];
      list.push(row);
      m.set(key, list);
    }
    for (const [, list] of m) {
      list.sort(
        (a, b) => new Date(a.raceDate).getTime() - new Date(b.raceDate).getTime()
      );
    }
    return m;
  }, [upcomingRaces]);

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
                {races.map((row) => {
                  const dayNum = new Date(row.raceDate).getDate();
                  return (
                    <li key={row.athleteRaceId}>
                      <Link
                        href={personalRaceHref(row)}
                        className="text-[11px] text-orange-800 hover:text-orange-950 hover:underline font-medium flex gap-1 min-w-0"
                        title={row.name}
                      >
                        <span className="text-gray-500 tabular-nums shrink-0">{dayNum}</span>
                        <span className="truncate">{row.name}</span>
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

function AthleteRaceCard({
  row,
  onGoalSaved,
  onRemove,
  onMarkPrimary,
  onUnmarkPrimary,
  removing,
  markingPrimary,
}: {
  row: AthleteRaceRow;
  onGoalSaved: (row: AthleteRaceRow, goal: InlineGoalRow) => void;
  onRemove: (athleteRaceId: string) => void;
  onMarkPrimary: (athleteRaceId: string) => void;
  onUnmarkPrimary: (athleteRaceId: string) => void;
  removing: boolean;
  markingPrimary: boolean;
}) {
  const goal = goalFromRace(row);

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm relative">
      <button
        type="button"
        onClick={() => onRemove(row.athleteRaceId)}
        disabled={removing}
        className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        aria-label="Remove from My Races"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="font-semibold text-gray-900 pr-7 leading-snug text-sm">{row.name}</p>
      {row.isPrimaryRace ? (
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-orange-800">
          <Flag className="w-3 h-3" />
          Goal race
        </p>
      ) : null}
      <p className="font-medium text-orange-600 text-[11px] mt-1">
        {countdownLabel(row.raceDate)}
      </p>
      <p className="text-gray-500 flex items-center gap-1 text-[11px] mt-1">
        <Calendar className="w-3 h-3 shrink-0" />
        {formatRaceListDate(row.raceDate)}
      </p>
      {(row.city || row.state) && (
        <p className="text-gray-500 flex items-center gap-1 text-[11px] mt-0.5">
          <MapPin className="w-3 h-3 shrink-0" />
          {[row.city, row.state].filter(Boolean).join(", ")}
        </p>
      )}
      <p className="text-gray-600 text-[11px] mt-1.5">
        {row.distanceLabel?.trim() ||
          (row.distanceMeters != null
            ? `${(row.distanceMeters / 1609.344).toFixed(1)} mi`
            : "—")}
      </p>

      {goal ? (
        <div className="mt-2.5">
          <InlineGoalForm
            race={raceForGoal(row)}
            goal={goal}
            onSaved={(updated) => onGoalSaved(row, updated)}
          />
        </div>
      ) : (
        <div className="mt-2.5">
          <InlineGoalForm
            race={raceForGoal(row)}
            goal={null}
            onSaved={(updated) => onGoalSaved(row, updated)}
          />
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        {row.isPrimaryRace ? (
          <button
            type="button"
            disabled={markingPrimary}
            onClick={() => onUnmarkPrimary(row.athleteRaceId)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Unmark as Goal race
          </button>
        ) : (
          <button
            type="button"
            disabled={markingPrimary}
            onClick={() => onMarkPrimary(row.athleteRaceId)}
            className="inline-flex items-center justify-center rounded-lg border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-900 hover:bg-orange-100 disabled:opacity-50"
          >
            Make this my Goal race
          </button>
        )}
        {row.goalTime?.trim() || row.trainingPlanId ? (
          <Link
            href={
              trainingPlanCtaForRace({
                athleteRaceId: row.athleteRaceId,
                trainingPlanId: row.trainingPlanId,
                goalTime: row.goalTime,
                myRaceHref: personalRaceHref(row),
              }).href
            }
            className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            {row.trainingPlanId ? "View plan" : "Add a plan"}
          </Link>
        ) : null}
        <Link
          href={personalRaceHref(row)}
          className="inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-2.5 py-1.5"
        >
          Get Ready →
        </Link>
        <button
          type="button"
          disabled={removing}
          onClick={() => onRemove(row.athleteRaceId)}
          className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
        >
          Remove from My Races
        </button>
      </div>
    </li>
  );
}

export default function MyRacesPage() {
  const router = useRouter();
  const [myRaces, setMyRaces] = useState<AthleteRaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingRaceId, setRemovingRaceId] = useState<string | null>(null);
  const [markingPrimaryRaceId, setMarkingPrimaryRaceId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const suRes = await api.get<{
        signups?: ApiAthleteRace[];
        athleteRaces?: ApiAthleteRace[];
      }>("/athlete-races");
      const raw = suRes.data.athleteRaces ?? suRes.data.signups ?? [];
      setMyRaces(raw.map(normalizeAthleteRace));
    } catch (e) {
      console.error(e);
      setMyRaces([]);
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

  const { upcomingRaces, pastRaces } = useMemo(() => {
    const up: AthleteRaceRow[] = [];
    const past: AthleteRaceRow[] = [];
    for (const row of myRaces) {
      if (daysUntilRace(row.raceDate) >= 0) up.push(row);
      else past.push(row);
    }
    return { upcomingRaces: up, pastRaces: past };
  }, [myRaces]);

  const upcomingSorted = useMemo(
    () =>
      [...upcomingRaces].sort(
        (a, b) => new Date(a.raceDate).getTime() - new Date(b.raceDate).getTime()
      ),
    [upcomingRaces]
  );

  const heroRace = useMemo(() => {
    const picked = pickHeroAthleteRace({
      upcoming: upcomingSorted.map((r) => ({
        athleteRaceId: r.athleteRaceId,
        raceDate: r.raceDate,
        isPrimaryRace: r.isPrimaryRace,
        trainingPlanId: r.trainingPlanId,
      })),
    });
    if (!picked) return null;
    return upcomingSorted.find((r) => r.athleteRaceId === picked.athleteRaceId) ?? null;
  }, [upcomingSorted]);

  const otherRaces = useMemo(
    () => upcomingSorted.filter((r) => r.athleteRaceId !== heroRace?.athleteRaceId),
    [upcomingSorted, heroRace]
  );

  const signedRaceIds = useMemo(
    () => new Set(myRaces.map((r) => r.raceRegistryId)),
    [myRaces]
  );

  async function onMarkPrimary(athleteRaceId: string) {
    setMarkingPrimaryRaceId(athleteRaceId);
    try {
      await api.patch(`/athlete-races/${encodeURIComponent(athleteRaceId)}`, {
        isPrimaryRace: true,
      });
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingPrimaryRaceId(null);
    }
  }

  async function onUnmarkPrimary(athleteRaceId: string) {
    setMarkingPrimaryRaceId(athleteRaceId);
    try {
      await api.patch(`/athlete-races/${encodeURIComponent(athleteRaceId)}`, {
        isPrimaryRace: false,
      });
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingPrimaryRaceId(null);
    }
  }

  async function onRemove(athleteRaceId: string, deleteActivePlan = false) {
    if (
      !deleteActivePlan &&
      !window.confirm("Remove this race from My Races? Your goal time on this row will be removed too.")
    ) {
      return;
    }

    setRemovingRaceId(athleteRaceId);
    try {
      const url = `/athlete-races/${encodeURIComponent(athleteRaceId)}${
        deleteActivePlan ? "?deleteActivePlan=true" : ""
      }`;
      await api.delete(url);
      setMyRaces((prev) => prev.filter((r) => r.athleteRaceId !== athleteRaceId));
      await loadAll();
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { requiresPlanDelete?: boolean } } };
      if (err.response?.status === 409 && err.response.data?.requiresPlanDelete) {
        const ok = window.confirm(
          "This race is tied to your active training plan. Delete the plan and remove this race? Completed workouts stay in your log."
        );
        if (ok) {
          await onRemove(athleteRaceId, true);
        }
      } else {
        console.error(e);
      }
    } finally {
      setRemovingRaceId(null);
    }
  }

  function onGoalSaved(row: AthleteRaceRow, updated: InlineGoalRow) {
    setMyRaces((prev) =>
      prev.map((r) =>
        r.athleteRaceId === row.athleteRaceId
          ? {
              ...r,
              goalTime: updated.goalTime?.trim() || null,
              goalRacePace: updated.goalRacePace ?? null,
              goalPace5K: updated.goalPace5K ?? null,
            }
          : r
      )
    );
  }

  const heroGoal = heroRace ? goalFromRace(heroRace) : null;

  return (
    <div className="space-y-8">
      {loading ? (
        <p className="text-gray-500 text-sm">Loading your races…</p>
      ) : myRaces.length === 0 ? (
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
              {pastRaces.length > 0 ? (
                <details className="group rounded-lg border border-gray-200 bg-white px-2 py-1.5 sm:max-w-xs sm:text-right">
                  <summary className="cursor-pointer list-none text-xs font-medium text-gray-600 hover:text-gray-900 [&::-webkit-details-marker]:hidden">
                    Past races ({pastRaces.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-left border-t border-gray-100 pt-2 max-h-40 overflow-y-auto">
                    {[...pastRaces]
                      .sort(
                        (a, b) =>
                          new Date(b.raceDate).getTime() - new Date(a.raceDate).getTime()
                      )
                      .map((row) => (
                        <li key={row.athleteRaceId} className="text-xs text-gray-700">
                          <span className="text-gray-400 tabular-nums mr-1">
                            {formatRaceListDate(row.raceDate)}
                          </span>
                          {row.name}
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>

          {heroRace ? (
            <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/80 via-white to-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {heroRace.logoUrl ? (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-orange-100 bg-white overflow-hidden shrink-0 shadow-sm">
                    <img
                      src={heroRace.logoUrl}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-orange-800 flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" />
                      {heroRace.isPrimaryRace ? "Goal race" : "Up next"}
                    </p>
                    <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-900 px-2.5 py-0.5 text-xs font-bold tabular-nums">
                      {countdownChipLabel(heroRace.raceDate)}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                    {heroRace.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {formatRaceListDate(heroRace.raceDate)}
                    </span>
                    {heroRace.city || heroRace.state ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {[heroRace.city, heroRace.state].filter(Boolean).join(", ")}
                      </span>
                    ) : null}
                    {heroRace.distanceLabel?.trim() ? (
                      <span className="font-medium text-gray-800">
                        {heroRace.distanceLabel}
                      </span>
                    ) : null}
                  </div>

                  {heroGoal ? (
                    <div className="mt-3">
                      <InlineGoalForm
                        race={raceForGoal(heroRace)}
                        goal={heroGoal}
                        onSaved={(updated) => onGoalSaved(heroRace, updated)}
                      />
                    </div>
                  ) : (
                    <div className="mt-3">
                      <InlineGoalForm
                        race={raceForGoal(heroRace)}
                        goal={null}
                        onSaved={(updated) => onGoalSaved(heroRace, updated)}
                      />
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(() => {
                      const primary = heroPrimaryCta(
                        heroRace,
                        personalRaceHref(heroRace)
                      );
                      return (
                        <>
                          {heroRace.isPrimaryRace ? (
                            <button
                              type="button"
                              disabled={markingPrimaryRaceId === heroRace.athleteRaceId}
                              onClick={() => void onUnmarkPrimary(heroRace.athleteRaceId)}
                              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                            >
                              Unmark as Goal race
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={markingPrimaryRaceId === heroRace.athleteRaceId}
                              onClick={() => void onMarkPrimary(heroRace.athleteRaceId)}
                              className="inline-flex items-center justify-center rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-900 hover:bg-orange-100"
                            >
                              Make this my Goal race
                            </button>
                          )}
                          <Link
                            href={primary.href}
                            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 shadow-sm"
                          >
                            {primary.label}
                          </Link>
                          <Link
                            href={`/race-hub/${heroRace.raceRegistryId}`}
                            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                          >
                            Race hub →
                          </Link>
                          <Link
                            href={personalRaceHref(heroRace)}
                            className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
                          >
                            Race prep
                          </Link>
                          <button
                            type="button"
                            disabled={removingRaceId === heroRace.athleteRaceId}
                            onClick={() => void onRemove(heroRace.athleteRaceId)}
                            className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                          >
                            Remove from My Races
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {otherRaces.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">
                {heroRace ? "Races along the way" : "Your races"}
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                {heroRace?.isPrimaryRace
                  ? "Other upcoming races before your Goal race."
                  : "Other upcoming races in My Races."}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {otherRaces.map((row) => (
                  <AthleteRaceCard
                    key={row.athleteRaceId}
                    row={row}
                    onGoalSaved={onGoalSaved}
                    onRemove={onRemove}
                    onMarkPrimary={onMarkPrimary}
                    onUnmarkPrimary={onUnmarkPrimary}
                    removing={removingRaceId === row.athleteRaceId}
                    markingPrimary={markingPrimaryRaceId === row.athleteRaceId}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {upcomingRaces.length > 0 ? (
            <section className="pt-6 border-t border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Next few months</h2>
              <p className="text-xs text-gray-500 mb-3">
                Quick view — tap a race to open your dashboard.
              </p>
              <NextSixMonthsRaceCards upcomingRaces={upcomingRaces} />
            </section>
          ) : null}

          <DiscoverRacesSection
            signedRaceIds={signedRaceIds}
            onRaceAdded={() => void loadAll()}
          />
        </>
      )}
    </div>
  );
}
