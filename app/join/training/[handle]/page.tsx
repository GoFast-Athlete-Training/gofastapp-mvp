"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";
import { formatCohortStartLabel } from "@/lib/training/cohort-display";

const TRAINING_JOIN_INTENT_KEY = "trainingCohortJoinIntent";
const TRAINING_JOIN_HANDLE_KEY = "trainingCohortJoinHandle";

type PublicCohort = {
  id: string;
  handle: string;
  cohortName: string;
  description: string | null;
  defaultPlanStartDate: string | null;
  currentWeekNumber: number | null;
  totalWeeks: number | null;
  memberCount: number;
  race: {
    name: string;
    raceDate: string;
    city: string | null;
    state: string | null;
    distanceLabel: string | null;
  };
  host: {
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
  } | null;
};

function hostDisplayName(host: PublicCohort["host"]): string {
  if (!host) return "your host";
  const name = [host.firstName, host.lastName].filter(Boolean).join(" ");
  if (name) return name;
  return host.gofastHandle ? `@${host.gofastHandle}` : "your host";
}

export default function TrainingCohortFrontDoorPage() {
  const params = useParams();
  const router = useRouter();
  const handle = (params.handle as string)?.trim() || "";
  const hasFetchedRef = useRef(false);

  const [cohort, setCohort] = useState<PublicCohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!handle) {
      setError("Missing handle");
      setLoading(false);
      return;
    }
    if (hasFetchedRef.current) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (hasFetchedRef.current) return;
      hasFetchedRef.current = true;
      setIsAuthenticated(!!firebaseUser);

      try {
        const res = await fetch(
          `/api/training-cohorts/public/${encodeURIComponent(handle)}`
        );
        if (!res.ok) {
          setError(res.status === 404 ? "not_found" : "error");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!data.success || !data.cohort) {
          setError("not_found");
          setLoading(false);
          return;
        }
        setCohort(data.cohort as PublicCohort);

        if (firebaseUser && LocalStorageAPI.getAthleteId()) {
          const joinIntent = localStorage.getItem(TRAINING_JOIN_INTENT_KEY);
          const joinHandle = localStorage.getItem(TRAINING_JOIN_HANDLE_KEY);
          if (joinIntent === data.cohort.id && joinHandle === handle) {
            router.replace(`/join/training/${encodeURIComponent(handle)}/confirm`);
            return;
          }

          try {
            const st = await api.get(
              `/training-cohorts/membership?cohortId=${encodeURIComponent(data.cohort.id)}`
            );
            if (st.data?.isMember && st.data?.membership?.trainingPlanId) {
              router.replace("/training");
              return;
            }
          } catch {
            /* not a member */
          }
        }
      } catch {
        setError("error");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [handle, router]);

  const handleJoinClick = () => {
    if (!cohort) return;
    if (!isAuthenticated) {
      localStorage.setItem(TRAINING_JOIN_INTENT_KEY, cohort.id);
      localStorage.setItem(TRAINING_JOIN_HANDLE_KEY, handle);
      router.push(`/join/training/${encodeURIComponent(handle)}/signup`);
      return;
    }
    localStorage.setItem(TRAINING_JOIN_INTENT_KEY, cohort.id);
    localStorage.setItem(TRAINING_JOIN_HANDLE_KEY, handle);
    router.push(`/join/training/${encodeURIComponent(handle)}/confirm`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Training group not found</h2>
          <Link href="/welcome" className="text-orange-600 font-semibold">
            Go to GoFast
          </Link>
        </div>
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <p className="text-gray-700">Something went wrong loading this group.</p>
        </div>
      </div>
    );
  }

  const startLabel = formatCohortStartLabel(cohort.defaultPlanStartDate);
  const weekLabel =
    cohort.currentWeekNumber != null && cohort.currentWeekNumber >= 1
      ? `Week ${cohort.currentWeekNumber}`
      : "Week 1";
  const hostName = hostDisplayName(cohort.host);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-sky-50 to-orange-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">
          Group training
        </p>
        <h1 className="text-2xl font-bold text-gray-900 leading-snug">{cohort.cohortName}</h1>
        <p className="text-sm text-gray-600 mt-2">
          {cohort.race.name}
          {cohort.race.distanceLabel ? ` · ${cohort.race.distanceLabel}` : ""}
        </p>
        {startLabel ? (
          <p className="text-sm font-medium text-orange-800 mt-3">
            Training starts {startLabel} — join {weekLabel}!
          </p>
        ) : null}
        {cohort.description ? (
          <p className="text-sm text-gray-700 mt-4 leading-relaxed">{cohort.description}</p>
        ) : (
          <p className="text-sm text-gray-700 mt-4 leading-relaxed">
            Train for {cohort.race.name} with {hostName}. You&apos;ll get your own plan built from
            the same structure — your paces, your schedule.
          </p>
        )}
        <p className="text-xs text-gray-500 mt-3">
          {cohort.memberCount} runner{cohort.memberCount !== 1 ? "s" : ""} in this group
        </p>

        <button
          type="button"
          onClick={handleJoinClick}
          className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl shadow-lg"
        >
          {isAuthenticated ? `Join ${weekLabel}` : "Sign up to join"}
        </button>

        {cohort.host?.gofastHandle ? (
          <Link
            href={`/u/${encodeURIComponent(cohort.host.gofastHandle)}`}
            className="mt-4 block text-center text-sm font-semibold text-orange-700 hover:text-orange-800"
          >
            View {hostName}&apos;s page →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
