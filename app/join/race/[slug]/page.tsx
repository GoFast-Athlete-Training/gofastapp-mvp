"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";
import { MapPin, Trophy } from "lucide-react";

const RACE_HUB_JOIN_INTENT_KEY = "raceHubJoinIntent";
const RACE_HUB_JOIN_INTENT_SLUG_KEY = "raceHubJoinIntentSlug";

type PublicRace = {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  raceDate: string;
  city: string | null;
  state: string | null;
  distanceLabel: string | null;
};

/**
 * Race Hub front door — /join/race/[slug]
 */
export default function RaceHubJoinFrontDoorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [race, setRace] = useState<PublicRace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoinConfirmation, setShowJoinConfirmation] = useState(false);
  const [joining, setJoining] = useState(false);
  /** Re-render when Firebase auth changes (button label). */
  const [firebaseUser, setFirebaseUser] = useState(() => auth.currentUser);

  /** Load public race card once per slug */
  useEffect(() => {
    if (!slug?.trim()) {
      setError("missing_slug");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRace() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/race-hub/public/resolve-by-slug/${encodeURIComponent(slug.trim())}`
        );
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("not_found");
          }
          throw new Error("fetch_failed");
        }
        const data = await res.json();
        if (!data.success || !data.race) {
          throw new Error("not_found");
        }
        if (!cancelled) {
          setRace(data.race as PublicRace);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.error("Race join front door load:", err);
          if ((err as Error)?.message === "not_found") {
            setError("not_found");
          } else {
            setError("error");
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRace();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const maybeRedirectMemberOrIntent = useCallback(
    async (r: PublicRace) => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;

      const me = LocalStorageAPI.getAthleteId();
      if (!me) return;

      const joinIntent = localStorage.getItem(RACE_HUB_JOIN_INTENT_KEY);
      const joinIntentSlug = localStorage.getItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);
      if (joinIntent && joinIntentSlug === slug.trim()) {
        router.replace(`/join/race/${encodeURIComponent(slug.trim())}/confirm`);
        return;
      }

      try {
        const memberCheck = await api.get(`/race-hub/${r.id}/members`);
        if (memberCheck.data?.success) {
          router.replace(`/race-hub/${r.id}`);
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status !== 403 && status !== 401) {
          console.error("Race hub membership check:", err);
        }
      }
    },
    [router, slug]
  );

  /** Auth + membership / join-intent redirects when race is known */
  useEffect(() => {
    if (!race || !slug?.trim()) return;

    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user && race) {
        void maybeRedirectMemberOrIntent(race);
      }
    });

    return () => unsub();
  }, [race, slug, maybeRedirectMemberOrIntent]);

  const handleJoinClick = () => {
    if (!race) return;

    const authed = !!firebaseUser;
    if (!authed) {
      router.push(`/join/race/${encodeURIComponent(slug.trim())}/signup`);
    } else {
      localStorage.setItem(RACE_HUB_JOIN_INTENT_KEY, race.id);
      localStorage.setItem(RACE_HUB_JOIN_INTENT_SLUG_KEY, slug.trim());
      setShowJoinConfirmation(true);
    }
  };

  const handleConfirmJoin = async () => {
    if (!race || joining) return;

    setJoining(true);
    try {
      await api.post(`/race-hub/${race.id}/join`, {});
      localStorage.removeItem(RACE_HUB_JOIN_INTENT_KEY);
      localStorage.removeItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);
      router.replace(`/race-hub/${race.id}`);
    } catch (err) {
      console.error("Race hub join:", err);
      alert("Failed to join race hub. Please try again.");
      setJoining(false);
    }
  };

  const handleCancelJoin = () => {
    localStorage.removeItem(RACE_HUB_JOIN_INTENT_KEY);
    localStorage.removeItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);
    setShowJoinConfirmation(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading race…</p>
        </div>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Race not found</h2>
          <p className="text-gray-600 mb-4">This race isn&apos;t on GoFast or the link may be wrong.</p>
          <Link
            href="/races"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            My Races
          </Link>
        </div>
      </div>
    );
  }

  if (error || !race) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">Couldn&apos;t load this race.</p>
          <Link href="/races" className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg">
            My Races
          </Link>
        </div>
      </div>
    );
  }

  const dateLabel = race.raceDate
    ? new Date(race.raceDate).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const locationText = [race.city, race.state].filter(Boolean).join(", ") || null;

  if (showJoinConfirmation && firebaseUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full px-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">You&apos;re back</h2>
              <p className="text-gray-600 mb-6 text-lg">
                Join <strong>{race.name}</strong> Race Hub — chat, meetups, and announcements?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void handleConfirmJoin()}
                  disabled={joining}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg disabled:opacity-50"
                >
                  {joining ? "Joining…" : "Let's go"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelJoin}
                  disabled={joining}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 px-6 py-3 rounded-xl font-semibold text-lg transition disabled:opacity-50"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {race.logoUrl?.trim() &&
              (race.logoUrl.startsWith("http") || race.logoUrl.startsWith("/")) ? (
                <img
                  src={race.logoUrl}
                  alt=""
                  className="w-20 h-20 rounded-xl object-contain border-2 border-gray-200 p-1"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white border-2 border-gray-200">
                  <Trophy className="w-10 h-10" />
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">{race.name}</h1>

            <div className="space-y-2 mb-6 text-sm text-gray-600">
              {dateLabel ? <p>{dateLabel}</p> : null}
              {locationText ? (
                <p className="flex items-center justify-center gap-1">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {locationText}
                </p>
              ) : null}
              {race.distanceLabel?.trim() ? (
                <p className="text-xs text-gray-500">{race.distanceLabel.split("|").join(" · ")}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleJoinClick}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg"
            >
              {firebaseUser ? "Join Race Hub" : "Sign up to join"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
