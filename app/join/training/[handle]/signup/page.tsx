"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import { formatCohortStartLabel } from "@/lib/training/cohort-display";

const TRAINING_JOIN_INTENT_KEY = "trainingCohortJoinIntent";
const TRAINING_JOIN_HANDLE_KEY = "trainingCohortJoinHandle";

type PublicCohort = {
  id: string;
  cohortName: string;
  defaultPlanStartDate: string | null;
  currentWeekNumber: number | null;
  race: { name: string; distanceLabel: string | null };
};

async function bootstrapAthleteAfterFirebase() {
  let athleteRes;
  try {
    const hydrateRes = await api.post("/athlete/hydrate", {});
    if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
      athleteRes = {
        data: {
          success: true,
          athleteId: hydrateRes.data.athlete.athleteId || hydrateRes.data.athlete.id,
          data: hydrateRes.data.athlete,
        },
      };
    } else {
      throw new Error("Hydrate invalid");
    }
  } catch (hydrateErr: unknown) {
    const status = (hydrateErr as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status !== 401) {
      const createRes = await api.post("/athlete/create", {});
      if (createRes.data?.success) {
        athleteRes = { data: createRes.data };
      } else {
        throw hydrateErr;
      }
    } else {
      throw hydrateErr;
    }
  }
  return athleteRes;
}

export default function TrainingCohortSignupPage() {
  const params = useParams();
  const router = useRouter();
  const handle = (params.handle as string)?.trim() || "";

  const [cohort, setCohort] = useState<PublicCohort | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      setFetching(false);
      return;
    }
    void fetch(`/api/training-cohorts/public/${encodeURIComponent(handle)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("not_found");
        const data = await res.json();
        if (!data.cohort) throw new Error("not_found");
        setCohort(data.cohort);
        localStorage.setItem(TRAINING_JOIN_INTENT_KEY, data.cohort.id);
        localStorage.setItem(TRAINING_JOIN_HANDLE_KEY, handle);
      })
      .catch(() => setError("not_found"))
      .finally(() => setFetching(false));
  }, [handle]);

  const confirmPath = `/join/training/${encodeURIComponent(handle)}/confirm`;
  const frontDoor = `/join/training/${encodeURIComponent(handle)}`;

  const afterAuth = async (firebaseUser: { uid: string; email: string | null }, token: string) => {
    localStorage.setItem("firebaseToken", token);
    const athleteRes = await bootstrapAthleteAfterFirebase();
    const athleteId =
      athleteRes?.data?.athleteId ||
      athleteRes?.data?.athlete?.athleteId ||
      athleteRes?.data?.athlete?.id;
    if (!athleteId) throw new Error("Failed to get athlete ID");
    localStorage.setItem("firebaseId", firebaseUser.uid);
    localStorage.setItem("athleteId", athleteId);
    localStorage.setItem("email", athleteRes?.data?.data?.email || firebaseUser.email || "");
    LocalStorageAPI.setAthleteId(athleteId);
    if (cohort) {
      localStorage.setItem(TRAINING_JOIN_INTENT_KEY, cohort.id);
      localStorage.setItem(TRAINING_JOIN_HANDLE_KEY, handle);
    }
    router.push(confirmPath);
  };

  const handleGoogle = async () => {
    if (!cohort) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const token = await result.user.getIdToken(true);
      await afterAuth(result.user, token);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Sign up failed");
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error === "not_found" || !cohort) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-700">Training group not found.</p>
      </div>
    );
  }

  const startLabel = formatCohortStartLabel(cohort.defaultPlanStartDate);
  const weekLabel =
    cohort.currentWeekNumber != null && cohort.currentWeekNumber >= 1
      ? `week ${cohort.currentWeekNumber}`
      : "week 1";

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">{cohort.cohortName}</h1>
        <p className="text-sm text-gray-600 mt-2">
          {cohort.race.name}
          {cohort.race.distanceLabel ? ` · ${cohort.race.distanceLabel}` : ""}
        </p>
        <p className="text-sm text-gray-700 mt-4 leading-relaxed">
          Create a GoFast account to join group training
          {startLabel ? ` starting ${startLabel}` : ""}. We&apos;ll build your personal plan for{" "}
          {weekLabel}.
        </p>
        {error && error !== "not_found" ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleGoogle()}
          className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? "Signing up…" : "Continue with Google"}
        </button>
        <Link
          href={frontDoor}
          className="mt-4 block text-center text-sm text-gray-600 hover:text-gray-800"
        >
          Back
        </Link>
      </div>
    </div>
  );
}
