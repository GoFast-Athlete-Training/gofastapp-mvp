"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { Calendar, MapPin, X, Users, Flag } from "lucide-react";
import {
  countdownLabel,
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

function personalRaceHref(r: RaceRegistryRow): string {
  const s = r.slug?.trim();
  return s ? `/myrace/${encodeURIComponent(s)}` : `/race-hub/${r.id}`;
}

function SignupRaceCard({
  signup,
  variant,
  goalSummary,
  onRemove,
  removing,
}: {
  signup: Signup;
  variant: "hero" | "default";
  goalSummary?: { goalTime: string | null };
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const r = signup.race_registry;
  const isHero = variant === "hero";
  return (
    <li
      className={`rounded-xl border shadow-sm p-4 relative ${
        isHero
          ? "border-orange-300 bg-gradient-to-br from-orange-50/90 to-white ring-2 ring-orange-200/80"
          : "border-orange-100 bg-white"
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
      {isHero ? (
        <p className="text-xs font-bold uppercase tracking-wide text-orange-800 mb-2 flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5" />
          Goal race
        </p>
      ) : null}
      <p className="font-semibold text-gray-900 pr-7 leading-snug">{r.name}</p>
      <p className="text-xs font-medium text-orange-600 mt-2">{countdownLabel(r.raceDate)}</p>
      {goalSummary?.goalTime ? (
        <p className="text-sm text-gray-800 mt-1">
          Goal time: <span className="font-mono font-semibold">{goalSummary.goalTime}</span>
        </p>
      ) : isHero ? (
        <p className="text-xs text-gray-600 mt-1">Set a finish time in Goals to build your plan.</p>
      ) : null}
      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
        <Calendar className="w-3.5 h-3.5" />
        {formatRaceListDate(r.raceDate)}
      </p>
      {(r.city || r.state) && (
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          {[r.city, r.state].filter(Boolean).join(", ")}
        </p>
      )}
      <p className="text-xs text-gray-600 mt-2">
        {r.distanceLabel?.trim() ||
          (r.distanceMeters != null
            ? `${(r.distanceMeters / 1609.344).toFixed(1)} mi`
            : r.distanceMiles != null
              ? `${r.distanceMiles} mi · ${r.raceType ?? "—"}`
              : "—")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={personalRaceHref(r)}
          className="inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-2"
        >
          My race →
        </Link>
        <Link
          href={`/race-hub/${r.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          <Users className="w-4 h-4 text-orange-600" />
          Community hub
        </Link>
        {r.registrationUrl ? (
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
  const [loading, setLoading] = useState(true);
  const [removingSignupId, setRemovingSignupId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [suRes, gRes] = await Promise.all([
        api.get<{ signups: Signup[] }>("/race-signups"),
        api.get<{ goals: GoalRow[] }>("/goals?status=ACTIVE").catch(() => ({ data: { goals: [] } })),
      ]);
      setSignups(suRes.data.signups ?? []);
      setGoals(gRes.data.goals ?? []);
    } catch (e) {
      console.error(e);
      setSignups([]);
      setGoals([]);
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

  const { heroSignup, otherSignups } = useMemo(() => {
    const heroRaceId = goals[0]?.raceRegistryId ?? goals[0]?.race_registry?.id ?? null;
    let hero: Signup | null = null;
    let others: Signup[] = [];
    if (heroRaceId) {
      for (const s of signups) {
        if (s.raceRegistryId === heroRaceId) hero = s;
        else others.push(s);
      }
    } else {
      others = [...signups];
    }
    return { heroSignup: hero, otherSignups: others };
  }, [signups, goals]);

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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Races</h1>
          <p className="text-gray-600 text-sm mt-1 max-w-xl">
            Races on your calendar. Your{" "}
            <span className="font-medium text-gray-800">goal race</span> is highlighted when you have
            an active goal. Community chat and shakeouts live in each race&apos;s hub.
          </p>
        </div>
        <Link
          href="/races/find"
          className="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50 shrink-0"
        >
          Find more races
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading your races…</p>
      ) : signups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-8 text-center text-sm text-gray-600">
          <p>No races on your calendar yet.</p>
          <Link
            href="/races/find"
            className="inline-block mt-3 text-orange-600 font-semibold hover:underline"
          >
            Find a race
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {heroSignup ? (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Goal race</h2>
              <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 max-w-xl">
                <SignupRaceCard
                  signup={heroSignup}
                  variant="hero"
                  goalSummary={{
                    goalTime: goalByRegistryId.get(heroSignup.raceRegistryId)?.goalTime?.trim() || null,
                  }}
                  onRemove={onRemove}
                  removing={removingSignupId === heroSignup.id}
                />
              </ul>
            </section>
          ) : goals.length > 0 ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
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
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otherSignups.map((s) => (
                  <SignupRaceCard
                    key={s.id}
                    signup={s}
                    variant="default"
                    onRemove={onRemove}
                    removing={removingSignupId === s.id}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
