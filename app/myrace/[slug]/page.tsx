"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { Calendar, MapPin, Users, Flag, ChevronLeft } from "lucide-react";
import { formatRaceListDate } from "@/lib/races-display";

type ResolvedRace = {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  raceDate: string;
  city: string | null;
  state: string | null;
  distanceLabel: string | null;
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
  raceRegistryId?: string | null;
  race_registry?: { id: string } | null;
};

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
      const [suRes, gRes] = await Promise.all([
        api.get<{ signups: Signup[] }>("/race-signups"),
        api.get<{ goals: GoalRow[] }>("/goals?status=ACTIVE").catch(() => ({ data: { goals: [] as const } })),
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
    } catch {
      setSignup(null);
      setGoal(null);
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
  const isGoalRace = Boolean(goal && goal.raceRegistryId === race.id);
  const hasSignup = Boolean(signup);

  return (
    <div>
      <Link
        href="/races"
        className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        My Races
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
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
        <p className="text-gray-500 text-sm">Loading your plan…</p>
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
      ) : isGoalRace ? (
        <section className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
            <Flag className="w-5 h-5 text-orange-600" />
            Your goal
          </h2>
          {goal?.goalTime ? (
            <p className="text-gray-800">
              Target finish:{" "}
              <span className="font-mono font-semibold">{goal.goalTime}</span>
            </p>
          ) : (
            <p className="text-gray-700 text-sm">Set a finish time to unlock your training plan.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/goals?raceRegistryId=${encodeURIComponent(race.id)}`}
              className="inline-flex justify-center rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-50"
            >
              {goal?.goalTime ? "Update goal" : "Set goal"}
            </Link>
            {goal?.id && goal.goalTime ? (
              <Link
                href={`/training-setup?goalId=${encodeURIComponent(goal.id)}`}
                className="inline-flex justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Training plan
              </Link>
            ) : null}
            <Link
              href={`/training`}
              className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              My training
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
          <p className="text-sm text-gray-700">
            This race is on your calendar. It&apos;s not your active goal race — you get logistics and
            community here; training focus follows your primary goal.
          </p>
          <Link
            href={`/goals?raceRegistryId=${encodeURIComponent(race.id)}`}
            className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:underline"
          >
            Make this my goal race
          </Link>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-600" />
          Community
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Announcements, race chatter, shakeout runs, and who&apos;s running — all live in the race hub.
        </p>
        <Link
          href={`/race-hub/${race.id}`}
          className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Open race hub
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
    </div>
  );
}
