"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";
import { ExternalLink, MapPin, Trophy } from "lucide-react";

const RACE_HUB_JOIN_INTENT_KEY = "raceHubJoinIntent";
const RACE_HUB_JOIN_INTENT_SLUG_KEY = "raceHubJoinIntentSlug";
const RACE_DIRECTORY_PATH = "/races/find";

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
};

function firstNameFromDisplayName(name: string | null | undefined): string | null {
  const first = (name || "").trim().split(/\s+/).filter(Boolean)[0];
  return first || null;
}

function athleteFirstName(user: User | null): string | null {
  if (!user) return null;
  return firstNameFromDisplayName(user.displayName);
}

function pageShell(className = "") {
  return `min-h-[100dvh] bg-gradient-to-br from-sky-50 to-orange-50 flex flex-col items-center justify-start sm:justify-center overflow-y-auto px-4 py-8 sm:py-10 ${className}`;
}

function cardShell(className = "") {
  return `max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-5 sm:p-8 ${className}`;
}

/**
 * Race Hub guard door — /join/race/[slug]
 * Confirms the athlete is running this race before creating signup + hub membership.
 */
export default function RaceHubJoinFrontDoorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [race, setRace] = useState<PublicRace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoinConfirmation, setShowJoinConfirmation] = useState(false);
  const [registrationNudge, setRegistrationNudge] = useState(false);
  const [joining, setJoining] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);

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
          console.error("Race join guard door load:", err);
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
      const currentUser = auth.currentUser;
      if (!currentUser) return;

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

  const handleRunningClick = () => {
    if (!race) return;

    if (!firebaseUser) {
      localStorage.setItem(RACE_HUB_JOIN_INTENT_KEY, race.id);
      localStorage.setItem(RACE_HUB_JOIN_INTENT_SLUG_KEY, slug.trim());
      router.push(`/join/race/${encodeURIComponent(slug.trim())}/signup`);
      return;
    }

    localStorage.setItem(RACE_HUB_JOIN_INTENT_KEY, race.id);
    localStorage.setItem(RACE_HUB_JOIN_INTENT_SLUG_KEY, slug.trim());
    setShowJoinConfirmation(true);
  };

  const handleConfirmJoin = async () => {
    if (!race || joining) return;

    setJoining(true);
    try {
      await api.post("/race-signups", { raceRegistryId: race.id });
      localStorage.removeItem(RACE_HUB_JOIN_INTENT_KEY);
      localStorage.removeItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);
      if (race.registrationUrl?.trim()) {
        setRegistrationNudge(true);
      } else {
        router.replace(`/race-hub/${race.id}`);
      }
    } catch (err) {
      console.error("Race signup:", err);
      alert("Couldn't add this race. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleCancelJoin = () => {
    localStorage.removeItem(RACE_HUB_JOIN_INTENT_KEY);
    localStorage.removeItem(RACE_HUB_JOIN_INTENT_SLUG_KEY);
    setShowJoinConfirmation(false);
    setRegistrationNudge(false);
  };

  const goToRaceHub = () => {
    if (!race) return;
    router.replace(`/race-hub/${race.id}`);
  };

  if (loading) {
    return (
      <div className={pageShell("justify-center")}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading race…</p>
        </div>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className={pageShell()}>
        <div className={cardShell()}>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Race not found</h2>
          <p className="text-gray-600 mb-4">This race isn&apos;t on GoFast or the link may be wrong.</p>
          <Link
            href={RACE_DIRECTORY_PATH}
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            Browse races
          </Link>
        </div>
      </div>
    );
  }

  if (error || !race) {
    return (
      <div className={pageShell()}>
        <div className={cardShell()}>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">Couldn&apos;t load this race.</p>
          <Link
            href={RACE_DIRECTORY_PATH}
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
          >
            Browse races
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
  const firstName = athleteFirstName(firebaseUser);
  const registrationUrl = race.registrationUrl?.trim() || null;

  if (showJoinConfirmation && firebaseUser && registrationNudge && registrationUrl) {
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
              href={registrationUrl}
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

  if (showJoinConfirmation && firebaseUser) {
    return (
      <div className={pageShell()}>
        <div className={cardShell()}>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Confirm you&apos;re running this race</h2>
            <p className="text-gray-600 mb-6 text-base leading-relaxed">
              We&apos;ll add <strong>{race.name}</strong> to My Races, put it on your GoFast calendar, and open the
              Race Hub for chatter and race-day updates.
            </p>
            <p className="text-xs text-gray-500 mb-6">
              This does not register you with the race organizer.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleConfirmJoin()}
                disabled={joining}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition shadow-lg disabled:opacity-50"
              >
                {joining ? "Adding…" : "Yes, I'm running this race"}
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
    );
  }

  return (
    <div className={pageShell()}>
      <div className={cardShell()}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {race.logoUrl?.trim() &&
            (race.logoUrl.startsWith("http") || race.logoUrl.startsWith("/")) ? (
              <img
                src={race.logoUrl}
                alt=""
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain border-2 border-gray-200 p-1"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white border-2 border-gray-200">
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
            )}
          </div>

          {firstName ? (
            <p className="text-sm font-medium text-orange-600 mb-1">Hi, {firstName}</p>
          ) : null}

          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            Ready to get moving toward {race.name}?
          </h1>

          <div className="space-y-1 mb-5 text-sm text-gray-600">
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

          <div className="mb-6 text-left space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              The Race Hub is for athletes participating in this race — chatter, meetups, and race-day updates with
              other runners.
            </p>
            <p>
              If you&apos;re running, we&apos;ll add it to My Races, put it on your GoFast calendar, and open the Race
              Hub.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <div>
              <button
                type="button"
                onClick={handleRunningClick}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-base sm:text-lg transition shadow-lg"
              >
                Yes, I&apos;m running this race
              </button>
              <p className="mt-2 text-xs text-gray-500 text-center">
                This does not register you with the race organizer.
              </p>
            </div>

            {registrationUrl ? (
              <a
                href={registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-orange-500 bg-white px-6 py-3 text-base sm:text-lg font-semibold text-orange-600 transition hover:bg-orange-50"
              >
                <ExternalLink className="w-5 h-5 shrink-0" />
                I plan to, but need to register first
              </a>
            ) : (
              <p className="text-center text-xs text-gray-500 py-2">
                Official registration link not available for this race yet.
              </p>
            )}

            <Link
              href={RACE_DIRECTORY_PATH}
              className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-xl font-semibold text-base transition"
            >
              No — just checking things out
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
