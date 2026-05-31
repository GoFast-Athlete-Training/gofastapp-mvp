"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";
import { ExternalLink } from "lucide-react";
import {
  isRegistrationOrganizerCtaOpen,
  registrationOrganizerStatusLabel,
} from "@/lib/registration-status";

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
  registrationUrl: string | null;
  registrationCloseDate: string | null;
  registrationSoldOut?: boolean | null;
  transferDeadline?: string | null;
};

function pageShell(className = "") {
  return `min-h-[100dvh] bg-gradient-to-br from-sky-50 to-orange-50 flex flex-col items-center justify-start sm:justify-center overflow-y-auto px-4 py-8 sm:py-10 ${className}`;
}

function cardShell(className = "") {
  return `max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-5 sm:p-8 ${className}`;
}

/**
 * Race Hub — confirm participant signup after auth
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
  const [registrationNudge, setRegistrationNudge] = useState(false);

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
      await api.post("/race-signups", { raceRegistryId: race.id });

      localStorage.removeItem(RACE_HUB_JOIN_INTENT_KEY);
      localStorage.removeItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);

      if (race.registrationUrl?.trim() && isRegistrationOrganizerCtaOpen({
        registrationUrl: race.registrationUrl,
        registrationCloseDate: race.registrationCloseDate,
        registrationSoldOut: race.registrationSoldOut,
      })) {
        setRegistrationNudge(true);
      } else {
        router.replace(`/race-hub/${race.id}`);
      }
    } catch (err) {
      console.error("Race signup confirm:", err);
      setJoinError("Failed to add this race. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const goToRaceHub = () => {
    if (!race) return;
    router.replace(`/race-hub/${race.id}`);
  };

  const handleNotNow = () => {
    localStorage.removeItem(RACE_HUB_JOIN_INTENT_KEY);
    localStorage.removeItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);
    router.push(frontDoorPath);
  };

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
      <div className={pageShell("justify-center")}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (fetchError === "not_found") {
    return (
      <div className={pageShell()}>
        <div className={cardShell()}>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Race not found</h2>
          <p className="text-gray-600 mb-4">This race isn&apos;t available.</p>
        </div>
      </div>
    );
  }

  if (fetchError === "error" || !race) {
    return (
      <div className={pageShell()}>
        <div className={cardShell()}>
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

  const registrationUrl = race.registrationUrl?.trim() || null;
  const organizerRegistrationOpen = isRegistrationOrganizerCtaOpen({
    registrationUrl: race.registrationUrl,
    registrationCloseDate: race.registrationCloseDate,
    registrationSoldOut: race.registrationSoldOut,
  });
  const activeRegistrationUrl = organizerRegistrationOpen ? registrationUrl : null;
  const organizerRegistrationStatus = registrationOrganizerStatusLabel({
    registrationUrl: race.registrationUrl,
    registrationCloseDate: race.registrationCloseDate,
    registrationSoldOut: race.registrationSoldOut,
  });

  if (registrationNudge && activeRegistrationUrl) {
    return (
      <div className={pageShell()}>
        <div className={cardShell()}>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">You&apos;re in for {race.name}</h2>
            <p className="text-gray-600 mb-4 text-left text-sm leading-relaxed">
              We added this race to My Races and opened the Race Hub. Have you registered with the race organizer
              yet? Use the official link when you&apos;re ready.
            </p>
            <a
              href={activeRegistrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-orange-500 bg-white px-6 py-3 text-lg font-semibold text-orange-600 transition hover:bg-orange-50"
            >
              <ExternalLink className="w-5 h-5 shrink-0" />
              Open official registration
            </a>
            <button
              type="button"
              onClick={() => goToRaceHub()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg"
            >
              Continue to Race Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShell()}>
      <div className={cardShell()}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Confirm you&apos;re running this race</h1>
          <p className="text-gray-600 text-base leading-relaxed">
            We&apos;ll add <strong>{race.name}</strong> to My Races, put it on your GoFast calendar, and open the Race
            Hub for chatter and race-day updates.
          </p>
          <p className="mt-3 text-xs text-gray-500">
            This does not register you with the race organizer.
          </p>
          {organizerRegistrationStatus ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {organizerRegistrationStatus} — you can still join the Race Hub on GoFast.
            </p>
          ) : null}
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
            {joining ? "Adding…" : "Yes, I'm running this race"}
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
  );
}
