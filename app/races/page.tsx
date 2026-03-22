"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import api from "@/lib/api";
import { MapPin, Calendar, Target } from "lucide-react";

type RaceRegistry = {
  id: string;
  name: string;
  raceType: string;
  distanceMiles: number;
  raceDate: string;
  city: string | null;
  state: string | null;
} | null;

type Goal = {
  id: string;
  distance: string;
  goalTime: string | null;
  goalRacePace: number | null;
  targetByDate: string;
  raceRegistryId: string | null;
  race_registry: RaceRegistry;
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

export default function RacesPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ goals: Goal[] }>("/goals?status=ACTIVE");
      setGoals(data.goals ?? []);
    } catch (e) {
      console.error(e);
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) router.replace("/signup");
    });
    return () => unsub();
  }, [router]);

  const primary = goals[0] ?? null;
  const race = primary?.race_registry ?? null;
  const hasLinkedRace = !!primary?.raceRegistryId && !!race;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Races</h1>
            <p className="text-gray-600 text-sm mb-8">
              Your goal race and active targets — linked from your race goal settings.
            </p>

            {loading ? (
              <p className="text-gray-500">Loading…</p>
            ) : hasLinkedRace && race ? (
              <div className="bg-white rounded-xl border border-orange-100 shadow-md p-6 mb-10">
                <div className="flex items-start gap-3 mb-4">
                  <Target className="w-8 h-8 text-orange-500 shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{race.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">Race registry ID: {race.id}</p>
                  </div>
                </div>
                <dl className="grid gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <dt className="sr-only">Race date</dt>
                    <dd>{formatDate(race.raceDate)}</dd>
                  </div>
                  {(race.city || race.state) && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <dt className="sr-only">Location</dt>
                      <dd>
                        {[race.city, race.state].filter(Boolean).join(", ")}
                      </dd>
                    </div>
                  )}
                  <div className="text-gray-700">
                    <span className="font-medium">Distance:</span> {race.distanceMiles} mi ·{" "}
                    <span className="font-medium">Type:</span> {race.raceType}
                  </div>
                </dl>
                {primary && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Your goal</h3>
                    <p className="text-sm text-gray-600">
                      {primary.distance}
                      {primary.goalTime ? ` · ${primary.goalTime}` : ""}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Target by {formatDate(primary.targetByDate)}
                    </p>
                  </div>
                )}
                <Link
                  href="/settings/race-goal"
                  className="inline-block mt-6 text-orange-600 font-medium text-sm hover:underline"
                >
                  Edit race goal
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-orange-200 p-8 text-center mb-10">
                <p className="text-gray-700 mb-2">No race linked to your active goal yet.</p>
                <p className="text-sm text-gray-500 mb-6">
                  Choose a race from the registry so this page shows your event details.
                </p>
                <Link
                  href="/settings/race-goal"
                  className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg font-medium text-sm"
                >
                  Set race goal
                </Link>
              </div>
            )}

            {goals.length > 1 && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">All active goals</h2>
                <ul className="space-y-3">
                  {goals.map((g) => (
                    <li
                      key={g.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 text-sm"
                    >
                      <p className="font-medium text-gray-900">
                        {g.race_registry?.name ?? "Goal (no race linked)"}
                      </p>
                      <p className="text-gray-600 mt-1">
                        {g.distance}
                        {g.goalTime ? ` · ${g.goalTime}` : ""}
                      </p>
                      {g.race_registry && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(g.race_registry.raceDate)} · {g.race_registry.distanceMiles} mi
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
