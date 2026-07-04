"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";
import { formatCohortStartLabel } from "@/lib/training/cohort-display";

const TRAINING_JOIN_INTENT_KEY = "trainingCohortJoinIntent";
const TRAINING_JOIN_HANDLE_KEY = "trainingCohortJoinHandle";

type PublicCohort = {
  id: string;
  cohortName: string;
  defaultPlanStartDate: string | null;
  currentWeekNumber: number | null;
  totalWeeks: number | null;
  race: { name: string; distanceLabel: string | null };
};

export default function TrainingCohortConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const handle = (params.handle as string)?.trim() || "";

  const [cohort, setCohort] = useState<PublicCohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalTime, setGoalTime] = useState("");
  const [replacePlan, setReplacePlan] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const frontDoor = `/join/training/${encodeURIComponent(handle)}`;

  const loadCohort = useCallback(async () => {
    const res = await fetch(`/api/training-cohorts/public/${encodeURIComponent(handle)}`);
    if (!res.ok) throw new Error("not_found");
    const data = await res.json();
    if (!data.cohort) throw new Error("not_found");
    return data.cohort as PublicCohort;
  }, [handle]);

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      setError("Missing handle");
      return;
    }

    const intent = localStorage.getItem(TRAINING_JOIN_INTENT_KEY);
    const intentHandle = localStorage.getItem(TRAINING_JOIN_HANDLE_KEY);
    if (!intent || intentHandle !== handle) {
      router.replace(frontDoor);
      return;
    }

    let cancelled = false;

    void loadCohort()
      .then((c) => {
        if (!cancelled) setCohort(c);
      })
      .catch(() => {
        if (!cancelled) setError("not_found");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      if (!user) router.replace(`${frontDoor}/signup`);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [handle, router, frontDoor, loadCohort]);

  const handleConfirm = async () => {
    if (!cohort || joining) return;
    if (!goalTime.trim()) {
      setError("Enter your goal finish time (e.g. 3:45:00 or 4:00:00)");
      return;
    }

    const intent = localStorage.getItem(TRAINING_JOIN_INTENT_KEY);
    if (intent !== cohort.id) {
      router.replace(frontDoor);
      return;
    }

    setJoining(true);
    setError(null);
    try {
      const res = await api.post(`/race-trainer/${cohort.id}/join`, {
        goalTime: goalTime.trim(),
        replaceActivePlan: replacePlan,
      });
      if (res.data?.success) {
        localStorage.removeItem(TRAINING_JOIN_INTENT_KEY);
        localStorage.removeItem(TRAINING_JOIN_HANDLE_KEY);
        if (res.data.alreadyMember) {
          router.replace("/training");
        } else {
          router.replace(`/training-setup/${res.data.trainingPlanId}`);
        }
        return;
      }
      throw new Error(res.data?.error || "Join failed");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e.response?.data?.error || "Could not join. Please try again.";
      if (msg.includes("active training plan")) {
        setReplacePlan(true);
      }
      setError(msg);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
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
  const weekNum = cohort.currentWeekNumber ?? 1;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Join group training</h1>
        <p className="text-sm text-gray-600 mt-2">{cohort.cohortName}</p>
        <p className="text-sm text-gray-700 mt-4 leading-relaxed">
          We&apos;ll add <strong>{cohort.race.name}</strong> to your calendar and generate your
          personal training plan
          {startLabel ? ` aligned to the group start (${startLabel})` : ""}.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          You&apos;re joining at week {weekNum}
          {cohort.totalWeeks ? ` of ${cohort.totalWeeks}` : ""}.
        </p>

        <div className="mt-6">
          <label htmlFor="goalTime" className="block text-sm font-medium text-gray-700 mb-1">
            Goal finish time
          </label>
          <input
            id="goalTime"
            type="text"
            value={goalTime}
            onChange={(e) => setGoalTime(e.target.value)}
            placeholder="e.g. 3:45:00"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            disabled={joining}
          />
        </div>

        {replacePlan || error?.includes("active training plan") ? (
          <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={replacePlan}
              onChange={(e) => setReplacePlan(e.target.checked)}
              className="mt-1"
            />
            Replace my current active training plan
          </label>
        ) : null}

        {error && error !== "not_found" ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={joining || !isAuthenticated}
            onClick={() => void handleConfirm()}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
          >
            {joining ? "Building your plan…" : `Join week ${weekNum}`}
          </button>
          <button
            type="button"
            disabled={joining}
            onClick={() => router.push(frontDoor)}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 rounded-xl disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
