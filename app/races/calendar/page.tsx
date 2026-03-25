"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { Calendar, MapPin, X } from "lucide-react";
import {
  countdownLabel,
  formatRaceListDate,
} from "@/lib/races-display";

type CatalogRace = {
  id: string;
  name: string;
  raceType: string;
  distanceMiles: number;
  raceDate: string;
  city: string | null;
  state: string | null;
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

export default function RacesCalendarPage() {
  const router = useRouter();
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loadingSignups, setLoadingSignups] = useState(true);
  const [removingSignupId, setRemovingSignupId] = useState<string | null>(null);

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

  useEffect(() => {
    loadSignups();
  }, [loadSignups]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) router.replace("/signup");
    });
    return () => unsub();
  }, [router]);

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
          <h1 className="text-2xl font-bold text-gray-900">My race calendar</h1>
          <p className="text-gray-600 text-sm mt-1 max-w-xl">
            Races you&apos;ve added from the catalog. Register on the official site — we help you
            track dates and countdowns. Set pace goals from{" "}
            <Link href="/goals" className="text-orange-600 font-medium hover:underline">
              Goals
            </Link>
            .
          </p>
        </div>
        <Link
          href="/races"
          className="text-sm text-orange-600 font-medium hover:underline shrink-0"
        >
          Browse races
        </Link>
      </div>

      {loadingSignups ? (
        <p className="text-gray-500 text-sm">Loading your races…</p>
      ) : signups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-8 text-center text-sm text-gray-600">
          <p>No races on your calendar yet.</p>
          <Link
            href="/races"
            className="inline-block mt-3 text-orange-600 font-medium hover:underline"
          >
            Browse upcoming races
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {signups.map((s) => {
            const r = s.race_registry;
            return (
              <li
                key={s.id}
                className="rounded-xl border border-orange-100 bg-white shadow-sm p-4 relative"
              >
                <button
                  type="button"
                  onClick={() => onRemove(s.id)}
                  disabled={removingSignupId === s.id}
                  className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  aria-label="Remove from calendar"
                >
                  <X className="w-4 h-4" />
                </button>
                <p className="font-semibold text-gray-900 pr-7 leading-snug">{r.name}</p>
                <p className="text-xs font-medium text-orange-600 mt-2">
                  {countdownLabel(r.raceDate)}
                </p>
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
                  {r.distanceMiles} mi · {r.raceType}
                </p>
                {r.registrationUrl ? (
                  <a
                    href={r.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-xs font-medium text-orange-600 hover:underline"
                  >
                    Open registration
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
