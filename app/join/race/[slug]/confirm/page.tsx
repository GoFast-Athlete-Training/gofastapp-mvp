"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";

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
 * Race Hub — confirm join after signup
 * Route: /join/race/[slug]/confirm
 */
export default function RaceHubJoinConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params.slug as string) || "";

  const [race, setRace] = useState<PublicRace | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<"not_found" | "error" | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const frontDoorPath = `/join/race/${encodeURIComponent(slug.trim())}`;

  const loadRace = useCallback(async () => {
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
    return data.race as PublicRace;
  }, [slug]);

  useEffect(() => {
    if (!slug.trim()) {
      setFetchError("error");
      setLoading(false);
      return;
    }

    const joinIntent = localStorage.getItem(RACE_HUB_JOIN_INTENT_KEY);
    const joinIntentSlug = localStorage.getItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);

    if (!joinIntent || joinIntentSlug !== slug.trim()) {
      setLoading(false);
      router.replace(frontDoorPath);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const r = await loadRace();
        if (cancelled) return;
        setRace(r);
      } catch (err: unknown) {
        if (!cancelled) {
          console.error("Race confirm load:", err);
          if ((err as Error)?.message === "not_found") {
            setFetchError("not_found");
          } else {
            setFetchError("error");
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void init();

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setIsAuthenticated(!!firebaseUser);
      if (!firebaseUser) {
        router.replace(frontDoorPath);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [slug, router, frontDoorPath, loadRace]);

  const handleConfirmJoin = async () => {
    if (!race || joining) return;

    const joinIntent = localStorage.getItem(RACE_HUB_JOIN_INTENT_KEY);
    const joinIntentSlug = localStorage.getItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);
    if (!joinIntent || joinIntentSlug !== slug.trim() || joinIntent !== race.id) {
      router.replace(frontDoorPath);
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      await api.post(`/race-hub/${race.id}/join`, {});

      localStorage.removeItem(RACE_HUB_JOIN_INTENT_KEY);
      localStorage.removeItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);

      router.replace(`/race-hub/${race.id}`);
    } catch (err) {
      console.error("Race hub confirm join:", err);
      setJoinError("Failed to join race hub. Please try again.");
      setJoining(false);
    }
  };

  const handleNotNow = () => {
    localStorage.removeItem(RACE_HUB_JOIN_INTENT_KEY);
    localStorage.removeItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);
    router.push(frontDoorPath);
  };

  /** Already a member → land in hub */
  useEffect(() => {
    if (!race || loading) return;

    const me = LocalStorageAPI.getAthleteId();
    if (!me || !isAuthenticated) return;

    let cancelled = false;

    api
      .get(`/race-hub/${race.id}/members`)
      .then(() => {
        if (!cancelled) {
          router.replace(`/race-hub/${race.id}`);
        }
      })
      .catch(() => {
        /* not a member — show confirm */
      });

    return () => {
      cancelled = true;
    };
  }, [race, loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (fetchError === "not_found") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Race not found</h2>
          <p className="text-gray-600 mb-4">This race isn&apos;t available.</p>
        </div>
      </div>
    );
  }

  if (fetchError === "error" || !race) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">Couldn&apos;t load this race.</p>
          <button
            type="button"
            onClick={handleNotNow}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-4xl" aria-hidden>
                ✓
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
            <p className="text-gray-600">
              Confirm to join <strong>{race.name}</strong> Race Hub.
            </p>
          </div>

          {joinError ? (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{joinError}</div>
          ) : null}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleConfirmJoin()}
              disabled={joining || !isAuthenticated}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg disabled:opacity-50"
            >
              {joining ? "Joining…" : "Let's go"}
            </button>

            <button
              type="button"
              onClick={handleNotNow}
              disabled={joining}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 px-6 py-3 rounded-xl font-semibold text-lg transition disabled:opacity-50"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
